from fastapi import APIRouter, Depends, HTTPException

from app.models.account import Account, Term
from app.services.canvas_client import CanvasAPIError, CanvasClient
from app.dependencies import get_canvas_client

router = APIRouter()


@router.get("/accounts", response_model=list[Account])
async def list_accounts(canvas: CanvasClient = Depends(get_canvas_client)):
    try:
        raw = await canvas.get_accounts()
    except CanvasAPIError as e:
        raise HTTPException(status_code=502, detail=e.message)
    return [Account(id=a["id"], name=a["name"]) for a in raw]


@router.get("/accounts/{account_id}/terms", response_model=list[Term])
async def list_terms(account_id: int, canvas: CanvasClient = Depends(get_canvas_client)):
    try:
        raw = await canvas.get_terms(account_id)
    except CanvasAPIError as e:
        raise HTTPException(status_code=502, detail=e.message)
    return [Term(id=t["id"], name=t["name"]) for t in raw]
