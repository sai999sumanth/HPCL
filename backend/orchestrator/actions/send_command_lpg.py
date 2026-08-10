import urdhva_base
import datetime
import pika
import pytz
import asyncio
import traceback
import json
import ast
import hpcl_ceg_model

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class SendCommandLpg:
    async def get_required_variables(self):
        return ["alert_id", "interrupt"]
    
    async def sendRQMessage(queuename, messageBody):
        credentials = pika.PlainCredentials(urdhva_base.settings.rabbitmq_username, urdhva_base.settings.rabbitmq_password)
        parameters = pika.ConnectionParameters(urdhva_base.settings.rabbitmq_host, urdhva_base.settings.rabbitmq_port, 
                                               urdhva_base.settings.rabbitmq_vhost, credentials, heartbeat=30)
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()
        channel.queue_declare(queue=queuename)
        channel.basic_publish(exchange='', routing_key=queuename, body=json.dumps(messageBody))
    
    async def sendcommand_lpg(self, params):
        print('SENDING COMMAND TO LPG alert_id:%s' % params.get('alert_id',''))
        try:
            redis_client = await urdhva_base.redispool.get_redis_connection()
            alert_data = await hpcl_ceg_model.Alerts.get(params.get('alert_id',''))
            if alert_data:
                if not isinstance(alert_data, dict):
                    alert_data = alert_data.__dict__
                else:
                    alert_data = alert_data
            
            else:
                print("Received a interrupt for unknown alert %s" % params.get('alert_id',''))
                return True, {"sendcommand": False}
            
            sap_id = alert_data['sap_id']
            enabledPlantKey = "LPG-Plant-Enabled-For-Send-command"
            enbPlant = await redis_client.lrange(enabledPlantKey, 0, -1)
            if str(sap_id) not in enbPlant:
                print("sap_id : %s Not Enabled for Write Command" % str(sap_id))
                return True, {"sendcommand": True}
            key = "LPG-" + sap_id + "-tripCount"
            altHistory = alert_data['alert_history']
            IST = pytz.timezone('Asia/Kolkata')
            currentTime = datetime.datetime.now(IST).strftime("%d-%m-%Y %H:%M:%S")
            tagpath = ""
            tagValue = False
            trip_key = "LPG_Trip_command_tag"
            tripCmd = await redis_client.hget(trip_key, sap_id)
            if tripCmd:
                tripData = json.loads(tripCmd)
                for key, val in tripData.items():
                    tagpath = key
                    tagValue = val
            
            if params.get('interrupt','') == "TripPlant":
                messageBody = {"tagsData": {tagpath: tagValue}}
                # await self.sendRQMessage(sap_id, messageBody)

                alert_message = " ".join([
                    f"Plant Trip Command Sent : {tagpath} : {str(tagValue)} At: {str(currentTime)}"
                ])
                print("Received input for tripping the plant %s" % str(sap_id))
                for i in range(3):
                    try:
                        update_history= {
                            "action_msg": alert_message,
                            "action_type": "Created",
                            "alert_status": "Open"
                        }
                        altHistory.append(update_history)
                        alert_data["alert_history"] = altHistory
                        alert_data['isTripped'] = True
                        await hpcl_ceg_model.Alerts(**alert_data).modify()
                        break
                    except Exception as e:
                        print("Exception updating isTripped Error:%s Traceback %s" % (e, traceback.format_exc()))
                        await asyncio.sleep(10)
            elif params.get('interrupt','') == "UnTripPlant":
                if str(tagValue) in ["0", "1"]:
                    if str(tagValue) == "0":
                        tagValue = 1
                    else:
                        tagValue = 0
                else:
                    tagValue = not tagValue
                print("Recieved input for untripping the plant %s" % str(sap_id))

                alert_message = " ".join([
                    f"Plant UnTrip Command Sent : {tagpath} : {str(tagValue)} At: {str(currentTime)}"
                ])
                messageBody = {"tagsData": {tagpath: tagValue}}
                # await self.sendRQMessage(sap_id, messageBody)
                for i in range(3):
                    try:
                        update_history= {
                            "action_msg": alert_message,
                            "action_type": "Created",
                            "alert_status": "Open"
                        }
                        altHistory.append(update_history)
                        alert_data['alert_history'] = altHistory
                        await hpcl_ceg_model.Alerts(**alert_data).modify()
                        break
                    except Exception as e:
                        print("Exception updating UnTripPlant Error:%s Traceback %s" % (e, traceback.format_exc()))
                        await asyncio.sleep(10)
            else:
                print("Unknown interrupt came")
        except Exception as e:
            print("Exception Occured While Sending Command for alert %s", params.get('alert_id'))
            print(e)
            print("Traceback %s" % traceback.format_exc())
        
        return True, {"sendcommand": True}