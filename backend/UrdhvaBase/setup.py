import setuptools
from setuptools import setup


setup(name='urdhva_base',
      version='1.0',
      description='Code generator & runtime ',
      url='',
      author='Venugopalnaidu Chandra(venu@algofusiontech.com)',
      author_email='',
      license='',
      packages=setuptools.find_packages(),
      package_data={'model': ['*.tx', '*.jinja']},
      install_requires=['fastapi==0.115.4', 'email-validator', 'elasticsearch[async]==8.12.1', 'httpx==0.26.0',
                        'jinja2==3.1.4', 'motor==3.3.2', 'textx==4.0.1', 'uvicorn==0.32.0', 'pydantic-settings==2.6.1',
                        'cryptography==43.0.3', 'pandas==2.2.3', 'numpy==2.1.3', 'redis==5.2.0', 'slowapi==0.1.9',
                        'mangum==0.17.0', 'python-keycloak==3.9.1', 'SQLAlchemy==2.0.36', 'SQLAlchemy-Utils==0.41.2',
                        'asyncpg==0.30.0', 'pymongo==4.8.0', 'python-multipart==0.0.17',
                        'setuptools'],
      zip_safe=False
      )
