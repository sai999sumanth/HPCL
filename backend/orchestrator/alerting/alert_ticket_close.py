import urdhva_base
import msgpack
import asyncio


async def process_and_enqueue_alert_closer():

    # 1. Fetch tickets
    query = """
        SELECT id, ticket_id, linked_alert_id, ticket_history
        FROM public.ticketing
        WHERE ticket_status = 'Open'
        AND linked_alert_id != '{}'
        AND auto_ticket_close = 'Yes'
    """

    tickets_res = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
    tickets = tickets_res.get("data", [])

    if not tickets:
        print("No tickets to process")
        return

    queue_ins = urdhva_base.redispool.RedisQueue("alert_closer_queue")

    # 2. Push each ticket to queue
    for ticket in tickets:

        linked_ids = ticket.get("linked_alert_id") or []

        if not linked_ids:
            continue

        input_data = {
            "ticket_data": {
                "id": ticket["id"],
                "ticket_id": ticket["ticket_id"],
                "linked_alert_id": linked_ids,
                "ticket_history": ticket.get("ticket_history", [])
            }
        }

        msg_data = msgpack.packb(input_data)

        await queue_ins.put(msg_data, skip_on_exists=True)

        print(f" Enqueued ticket: {ticket['ticket_id']}")


if __name__ == "__main__":
    asyncio.run(process_and_enqueue_alert_closer())