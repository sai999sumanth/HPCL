import urdhva_base
from hpcl_ceg_ticketing_model import *
from fastapi import APIRouter, HTTPException, Form, File, UploadFile
import traceback
import datetime
import json
import api_manager_ticketing.api_helpers as api_helpers
from typing import List

router = fastapi.APIRouter(prefix='/ticketcomment')


# Action add_comment_to_ticket
@router.post('/add_comment_to_ticket', tags=['TicketComment'])
async def ticketcomment_add_comment_to_ticket(data: Ticketcomment_Add_Comment_To_TicketParams):
    try:
        ticket_id = data.ticket_id
        content = data.content
        documents = data.documents or []

        rpt = urdhva_base.context.context.get('rpt', None)
        user = rpt.get("username") if rpt else "system"

        comment = await TicketCommentCreate(
            ticket_id=ticket_id,
            created_by=user,
            content=content,
            documents=documents,
            update_history=[]
        ).create()

        return {
            "status": True,
            "message": "Comment added successfully",
            "data": comment
        }

    except ValueError as ve:
        return {
            "status": False,
            "message": f"Validation Error: {str(ve)}",
            "data": None
        }

    except Exception as e:
        traceback.print_exc()

        return {
            "status": False,
            "message": "Something went wrong while adding comment",
            "error": str(e),
            "data": None
        }


# Action edit_comment
@router.post('/edit_comment', tags=['TicketComment'])
async def ticketcomment_edit_comment(data: Ticketcomment_Edit_CommentParams):
    try:
        ticket_id = data.ticket_id
        comment_id = data.comment_id
        new_content = data.content
        documents = data.documents or []

        query = f"id='{comment_id}' and ticket_id='{ticket_id}'"
        params = urdhva_base.queryparams.QueryParams()
        params.limit = 1
        params.q = query

        resp = await TicketComment.get_all(params, resp_type="plain")

        if not resp or len(resp.get("data", [])) == 0:
            raise HTTPException(status_code=404, detail="Comment not found")

        comment = resp["data"][0]

        # Get current content and existing history
        old_content = comment.get("content", "")
        update_history = comment.get("update_history")

        if not isinstance(update_history, list):
            update_history = []

        rpt = urdhva_base.context.context.get('rpt', None)
        user = rpt.get("username") if rpt else "system"

        # Add history entry
        update_history.append(json.dumps({
            "old_content": old_content,
            "updated_by": user,
            "updated_time": datetime.datetime.now().isoformat()
        }))

        await TicketComment(
            id=comment["id"],
            content=new_content,
            documents=documents,
            update_history=update_history
        ).modify()

        return {
            "status": True,
            "message": "Comment updated successfully",
            "data": {
                "comment_id": comment_id,
                "content": new_content
            }
        }

    except HTTPException as http_exc:
        raise http_exc

    except ValueError as ve:
        return {
            "status": False,
            "message": f"Validation Error: {str(ve)}",
            "data": None
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="Something went wrong while updating comment"
        )


# Action delete_comment
@router.post('/delete_comment', tags=['TicketComment'])
async def ticketcomment_delete_comment(data: Ticketcomment_Delete_CommentParams):
    try:
        ticket_id = data.ticket_id
        comment_id = data.comment_id

        params = urdhva_base.queryparams.QueryParams()
        params.q = f"id='{comment_id}' and ticket_id='{ticket_id}'"
        params.limit = 1

        resp = await TicketComment.get_all(params, resp_type='plain')

        if not resp or len(resp.get("data", [])) == 0:
            raise HTTPException(status_code=404, detail="Comment not found")

        comment = resp["data"][0]

        await TicketComment.delete(comment["id"])

        return {
            "status": True,
            "message": "Comment deleted successfully",
            "data": comment_id
        }

    except HTTPException as http_exc:
        raise http_exc

    except ValueError as ve:
        return {
            "status": False,
            "message": f"Validation Error: {str(ve)}",
            "data": None
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="Something went wrong while deleting comment"
        )


# Action attach_file_to_comment
@router.post('/attach_file_to_comment', tags=['TicketComment'])
async def ticketcomment_attach_file_to_comment(
        ticket_id: str = Form(...),
        comment_id: str = Form(...),
        upload_files: List[UploadFile] = File(...)
):
    try:
        return await api_helpers.attach_file_common(
            model_class=TicketComment,
            ticket_id=ticket_id,
            comment_id=comment_id,
            upload_files=upload_files,
            attachment_field="documents"
        )
    except Exception as e:
        return {
            "status": False,
            "message": f"Error attaching file: {str(e)}"
        }


# Action download_attachment
@router.post('/download_attachment', tags=['TicketComment'])
async def ticketcomment_download_attachment(data: Ticketcomment_Download_AttachmentParams):
    try:
        return await api_helpers.download_attachment_common(
            model_class=TicketComment,
            record_id=data.ticket_id,
            requested_file_name=data.file_attachment_name,
            attachment_field="documents"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
