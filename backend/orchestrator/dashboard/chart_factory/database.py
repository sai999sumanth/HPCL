import urdhva_base
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine


async def get_db_session(id):
    """
    Retrieves a database session asynchronously.

    Parameters:
    id (str): The identifier for the database session.

    Returns:
    database_async_session (AsyncSession): An asynchronous database session.
    """
    database_url = str(urdhva_base.settings.db_urls["postgres_async"][0])
    database_engine = create_async_engine(database_url, echo=False, poolclass=NullPool)
    database_async_session = sessionmaker(
        bind=database_engine,
        expire_on_commit=False,
        class_=AsyncSession
    )
    return database_async_session