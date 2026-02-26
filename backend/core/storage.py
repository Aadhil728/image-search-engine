"""MinIO S3-compatible storage integration."""
import boto3
from io import BytesIO
from typing import Optional
from core.config import settings
from concurrent.futures import ThreadPoolExecutor
import asyncio


class MinIOClient:
    """MinIO S3-compatible storage client."""
    
    def __init__(self):
        """Initialize MinIO client."""
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name="us-east-1",
        )
        self.executor = ThreadPoolExecutor(max_workers=4)
    
    async def upload_file(
        self,
        bucket: str,
        file_key: str,
        file_data: BytesIO,
        content_type: str = "application/octet-stream",
    ) -> str:
        """Upload file to MinIO and return the URL."""
        try:
            # Ensure bucket exists
            await self._ensure_bucket(bucket)
            
            # Upload file using thread pool to avoid blocking
            file_data.seek(0)  # Reset file pointer
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                self.executor,
                lambda: self.client.upload_fileobj(
                    file_data,
                    bucket,
                    file_key,
                    ExtraArgs={"ContentType": content_type}
                )
            )
            
            # Return the S3 URL (use public endpoint for browser access)
            url = f"{settings.S3_PUBLIC_ENDPOINT}/{bucket}/{file_key}"
            print(f"✅ Uploaded to MinIO: {url}")
            return url
        except Exception as e:
            print(f"❌ MinIO upload error: {e}")
            raise
    
    async def delete_file(self, bucket: str, file_key: str) -> bool:
        """Delete file from MinIO."""
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                self.executor,
                lambda: self.client.delete_object(Bucket=bucket, Key=file_key)
            )
            print(f"✅ Deleted from MinIO: s3://{bucket}/{file_key}")
            return True
        except Exception as e:
            print(f"❌ MinIO delete error: {e}")
            raise
    
    async def _ensure_bucket(self, bucket: str) -> bool:
        """Ensure bucket exists, create if not, and set public read policy."""
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                self.executor,
                lambda: self.client.head_bucket(Bucket=bucket)
            )
            return True
        except Exception:
            # Bucket doesn't exist, create it
            try:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(
                    self.executor,
                    lambda: self.client.create_bucket(Bucket=bucket)
                )
                print(f"✅ Created MinIO bucket: {bucket}")
                
                # Set public read policy
                import json
                policy = {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Principal": {"AWS": ["*"]},
                            "Action": ["s3:GetObject"],
                            "Resource": [f"arn:aws:s3:::{bucket}/*"]
                        }
                    ]
                }
                await loop.run_in_executor(
                    self.executor,
                    lambda: self.client.put_bucket_policy(Bucket=bucket, Policy=json.dumps(policy))
                )
                print(f"✅ Set public read policy on bucket: {bucket}")
                return True
            except Exception as e:
                print(f"⚠️  Bucket may already exist: {e}")
                return False


# Global MinIO client instance
_minio_client: Optional[MinIOClient] = None


def get_minio_client() -> MinIOClient:
    """Get or initialize MinIO client."""
    global _minio_client
    if _minio_client is None:
        _minio_client = MinIOClient()
    return _minio_client


async def upload_to_minio(
    bucket: str,
    file_key: str,
    file_data: BytesIO,
    content_type: str = "image/jpeg",
) -> str:
    """Upload a file to MinIO and return the URL."""
    client = get_minio_client()
    return await client.upload_file(bucket, file_key, file_data, content_type)


async def ensure_bucket_public(bucket: str = None) -> bool:
    """Ensure the bucket exists and has public read policy. Call at startup."""
    import json
    if bucket is None:
        bucket = settings.S3_BUCKET_NAME
    
    client = get_minio_client()
    try:
        # Create bucket if not exists
        try:
            client.client.head_bucket(Bucket=bucket)
        except Exception:
            client.client.create_bucket(Bucket=bucket)
            print(f"✅ Created MinIO bucket: {bucket}")
        
        # Set public read policy
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{bucket}/*"]
                }
            ]
        }
        client.client.put_bucket_policy(Bucket=bucket, Policy=json.dumps(policy))
        print(f"✅ Set public read policy on bucket: {bucket}")
        return True
    except Exception as e:
        print(f"⚠️ Failed to ensure bucket public: {e}")
        return False


async def delete_from_minio(bucket: str, file_key: str) -> bool:
    """Delete a file from MinIO."""
    client = get_minio_client()
    return await client.delete_file(bucket, file_key)
