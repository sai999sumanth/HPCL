import urdhva_base
import datetime
import orchestrator.notification_manager.notification_factory as notification_factory
import asyncio

class VTSLiveNoData:
    def __init__(self):
        # The Master list ensures we check every type even if the DB returns nothing for it
        self.target_violations = ['HS', 'RD', 'TC', 'WR']
        self.threshold_hours = 12

    async def check_no_ongoing_data(self):
        now = datetime.datetime.now(datetime.timezone.utc)
        threshold_seconds = self.threshold_hours * 3600

        query = """
                SELECT violation_type, MAX(created_at) as last_recorded
                FROM vts_ongoing_trips
                WHERE violation_type in ('HS', 'RD', 'TC', 'WR')
                GROUP BY violation_type
                """
        try:
            # response format: {'data': [{'violation_type': 'HS', ...}], 'count': 4, ...}
            response = await urdhva_base.BasePostgresModel.get_aggr_data(query)
            
            # Extract the actual list of rows from the 'data' key
            rows = response.get('data', [])

            # Map the rows into a searchable dictionary: { 'HS': datetime, 'RD': datetime, ... }
            data_map = {row['violation_type']: row['last_recorded'] for row in rows}
            
            print(f"Current DB Data Map: {data_map}")
            
            for v_type in self.target_violations:
                last_seen = data_map.get(v_type)
                display_time = ""
                send_alert = False

                if last_seen:
                    # Fix timezone if the database returns naive datetime objects
                    if last_seen.tzinfo is None:
                        last_seen = last_seen.replace(tzinfo=datetime.timezone.utc)
                    
                    diff = (now - last_seen).total_seconds()
                    
                    # Check if the delay exceeds the 12-hour threshold
                    if diff > threshold_seconds:
                        send_alert = True
                        display_time = last_seen.strftime('%Y-%m-%d %H:%M:%S UTC')
                else:
                    # Case: The violation type is missing entirely from the DB results
                    send_alert = True

                # This block is INSIDE the loop, so it will trigger for each violation type
                if send_alert:
                    await self.send_no_data_mail(v_type, display_time)
                    # Optional: small delay to prevent email rate limiting
                    await asyncio.sleep(1) 

        except Exception as e:
            print(f"Error Executing VTS Ongoing data Check: {e}")
    
    async def send_no_data_mail(self, violation_code, last_time):
        names = {
            "HS": "Unauthorized Stoppage at Hotspots (HS)",
            "RD": "Route Deviation (RD)",
            "TC": "Trip Not Closed (TC)",
            "WR": "Trip Without Route (WR)"
        }
        full_name = names.get(violation_code, violation_code)
        
        # Get the notification module
        ins = await notification_factory.get_notification_module("email")

        # Fallback text if display_time is empty (no data found at all)
        time_info = last_time if last_time else "No data found in table"

        await ins.publish_message(
            subject=f"VTS Issue: No {violation_code} Data Received",
            recipients=["mberde@aryaomnitalk.com"],
            cc_recipients=["adityapandey@hpcl.in","purushm@hpcl.in","adeshingkar@aryaomnitalk.com","kshah@aryaomnitalk.com",
                           "pankajkarmakar@hpcl.in ","rameshyadav.p@hpcl.in",
                           "gauravyadav1@hpcl.in","sreedhar.maddipati@algofusiontech.com",
                           "venu@algofusiontech.com","moufikali@algofusiontech.com", "manohar.v@algofusiontech.com"],
            html_content=True,
            body=f"""
            <p>Hi Sir,</p>
            <p>Data for violation type <b>{full_name}</b> is not being received from the VTS <b>ongoingtripsvts API</b> 
            to the server</b>.</p>
            <p><b>Status:</b> No data received for more than {self.threshold_hours} hours.<br>
            <b>Last Activity Recorded:</b> {time_info}</p>
            <p>Kindly check and resolve the issue for this specific violation type at the earliest.</p>
            <p>Thanks & Regards,<br>Novex System</p>
            """,
            force_send=True
        )

if __name__ == "__main__":
    monitor = VTSLiveNoData()
    asyncio.run(monitor.check_no_ongoing_data())