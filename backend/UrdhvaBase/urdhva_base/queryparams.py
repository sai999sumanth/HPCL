from typing import Optional
from fastapi import Query
from pydantic import BaseModel, Field


class QueryParams(BaseModel):
    q: Optional[str] = Query(None, description="Filter query to be executed against the database.")
    search_text: Optional[str] = Query(None, description="Content to search on", regex='^([a-zA-Z0-9_.\\-=" ]+|)$')
    skip: int = Field(0, ge=0, le=10000, description="Number of records to skip")
    limit: int = Field(100, ge=0, le=10000, description="Max number of records to fetch")
    sort: Optional[str] = None
    fields: Optional[str] = None
    view: Optional[str] = Query(None,
                                description="An optional parameter for action views. This parameter will be discarded for API calls")
