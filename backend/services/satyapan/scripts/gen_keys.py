from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
import os

def generate_keys():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    public_pem = key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    
    os.makedirs('certs', exist_ok=True)
    
    with open('certs/private.pem', 'wb') as f:
        f.write(private_pem)
    
    with open('certs/public.pem', 'wb') as f:
        f.write(public_pem)
        
    print("Keys generated in certs/ directory.")

if __name__ == "__main__":
    generate_keys()
