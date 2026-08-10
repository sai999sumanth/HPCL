import asyncio
import msgpack
import traceback
import urdhva_base
import hpcl_ceg_model
import hpcl_ceg_ticketing_model
import redis.exceptions

from datetime import datetime


class AlertCloserListener:
    QUEUE_NAME = "alert_closer_queue"

    @classmethod
    async def start_listener(cls):
        try:
            queue_ins = urdhva_base.redispool.RedisQueue(cls.QUEUE_NAME)

            print("Alert Closer Listener Started...")

            while True:
                try:
                    msg_data = await queue_ins.get()

                    if not msg_data:
                        await asyncio.sleep(1)
                        continue

                    # Safe unpack
                    data = msgpack.unpackb(msg_data, raw=False)
                    ticket = data.get("ticket_data")

                    if ticket:
                        await cls.process_ticket(ticket)

                except redis.exceptions.TimeoutError:
                    # Same as your reference
                    await asyncio.sleep(1)
                    continue

                except asyncio.CancelledError:
                    #KEY FIX
                    print("CancelledError caught — continuing listener")
                    await asyncio.sleep(1)
                    continue

                except Exception:
                    print("Error inside listener loop")
                    traceback.print_exc()
                    await asyncio.sleep(1)

        except Exception:
            print("Failed to start listener")
            traceback.print_exc()

    # ---------------------------------------------------------
    # PROCESS EACH TICKET
    # ---------------------------------------------------------
    @staticmethod
    async def process_ticket(ticket):

        try:
            ticket_id = ticket.get("ticket_id")
            db_id = ticket.get("id")
            linked_ids = ticket.get("linked_alert_id") or []

            if not linked_ids:
                print(f"Skipping {ticket_id} (no alerts)")
                return

            # Fetch alerts
            linked_data = f"id in ({','.join(map(str, linked_ids))})"

            params = urdhva_base.queryparams.QueryParams(q=linked_data, limit=10000)
            params.fields = ["id", "alert_status"]

            resp = await hpcl_ceg_model.Alerts.get_all(params, resp_type='plain')
            alerts = resp.get("data", [])

            if not alerts:
                print(f"No alerts found for {ticket_id}")
                return

            # Check all closed
            all_closed = all(alert.get("alert_status") == "Close" for alert in alerts)

            if not all_closed:
                print(f"Ticket {ticket_id} still has OPEN alerts")
                return

            # Close ticket
            history = ticket.get("ticket_history") or []

            history.append({
                "processed_time": datetime.now().isoformat(),
                "action_msg": "Ticket is auto-closed when all linked alerts are closed.",
                "action_type": "AUTO_CLOSE"
            })

            await hpcl_ceg_ticketing_model.Ticketing(
                id=db_id,
                ticket_state="Reviewed By Occ",
                ticket_status="Close",
                ticket_history=history
            ).modify()

            print(f"Auto-closed ticket: {ticket_id}")

        except asyncio.CancelledError:
            print(f"Cancelled while processing {ticket.get('ticket_id')}")
            return

        except Exception:
            print(f"Error processing ticket {ticket.get('ticket_id')}")
            traceback.print_exc()



if __name__ == "__main__":
    asyncio.run(AlertCloserListener.start_listener())