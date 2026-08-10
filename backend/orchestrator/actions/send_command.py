import urdhva_base
import traceback
import hpcl_ceg_model
# import ThingsBoardApi
from utilities import bu_key_mapping

logger = urdhva_base.logger.Logger.getInstance("workflow_process-log")

class SendCommand:
    async def get_required_variables(self):
        """
        Returns a list of strings representing the required variables for the action.

        Returns:
            list: A list of strings representing the required variables.
        """
        return ["alert_id", "type", "shutdownPump", "interrupt", "inlet", "outlet", "tanks"]


    async def sendcommand(self, params):
        """
        This function sends a command to the respective device based on the parameters passed.
        Command can be either to shutdown or start the device.
        Parameters:
        - alert_id: The alert id for which the command is to be sent.
        - type: The type of command to be sent. It can be either 'product', 'pumps', 'rosov', 'mov'.
        - shutdownPump: A boolean indicating whether to shutdown the pump or not.
        - interrupt: A string indicating the type of interrupt. It can be either 'shutdown' or 'start'.
        - inlet: A boolean indicating whether to open or close the inlet valve.
        - outlet: A boolean indicating whether to open or close the outlet valve.
        - tanks: A string indicating the tanks to which the command is to be sent. It can be either 'all' or a comma separated list of tank ids.
        Returns:
        - A tuple containing a boolean indicating success and a dictionary containing the key 'pendingTanks', 'completedTanks' and 'taskstatus'.
        """
        alert_id = params.get("alert_id")
        try:

            aldata = await hpcl_ceg_model.Alerts.get(alert_id)
            # tb = ThingsBoardApi.TB('tas', aldata['sap_id'])
            commands = ''
            cmddata = {}
            pumptype = params.get('type')
            isPumpShutDown = params.get('shutdownPump')
            interrupt = params.get('interrupt')
            inlet = params.get('inlet')
            inlet = True if inlet == 'true' else False
            outlet = params.get('outlet')
            outlet = True if outlet == 'true' else False
            tanks = params.get('tanks')
            cmdvalue = 0
            if interrupt and interrupt.lower() == 'shutdown':
                cmdvalue = 1
            if pumptype:
                pumptype = pumptype.split(',')
                pumptype = [pt.lower() for pt in pumptype]
            sapid = aldata.sap_id if aldata.sap_id else '0'
            if tanks and tanks.lower() == 'all':
                # get all tanks from location attributes 
                tankids = [] 
                status, loc_dt = await alert_helper.get_location_details(bu=bu_location_type,sap_id=sap_id)
                if status:
                    locationid = loc_dt.get('sap_id')
                # locationdata = tb.getAssetData(locationid)
                if not locationdata:
                    return True, {"pendingTanks": [], 'completedTanks': [], 'taskstatus': True}
                for ld in locationdata:
                    if ld['key'] == 'TankIds':
                        tankids = ld['value']
                        if tankids:
                            tankids = tankids.split(',')

                checkhlevel = False
                if interrupt == "shutdown":
                    checkhlevel = True

                tankids = [tankid.strip() for tankid in tankids]
                completedTanks = []
                while len(completedTanks) != len(tankids):
                    print("TOTAL:%s COMPLETED:%s" % (len(tankids), len(completedTanks)))
                    print("COMPLETED TANKS LIST:%s" % completedTanks)
                    threads = []
                    for tankid in tankids:
                        if tankid not in completedTanks:
                            print("STARTING TANKID:%s INTERUPT:%s" % (tankid, interrupt))
                            # threads.append(gevent.spawn(check_send, tb, sapid, cmdvalue, tankid, True, True, True, inlet,
                            #                              outlet, False, True, True, checkhlevel=checkhlevel))
                            threads.append(gevent.spawn(check_send, sapid, cmdvalue, tankid, True, True, True, inlet,
                                                         outlet, False, True, True, checkhlevel=checkhlevel))
                    # Block until all threads complete.
                    gevent.joinall(threads)
                    for thread in threads:
                        if thread.value:
                            completedTanks.append(thread.value)

                    print("After loop TOTAL:%s COMPLETED:%s" % (len(tankids), len(completedTanks)))

                return True, {"pendingTanks": [], 'completedTanks': [], 'taskstatus': True}

            devicedata = {}
            deviceid = aldata.device_id if aldata.device_id else ''
            interlockname = aldata.interlock_name
            if deviceid:
                # get device attributes
                # devicedata = tb.getTanks(deviceid)
                if devicedata:
                    devicedata = devicedata[0]

            if pumptype:
                if pumptype == 'product':
                    # server_attrib = tb.getDeviceServerAttrib(devicedata)
                    for sb in server_attrib:
                        if interlockname in bu_key_mapping.alertmap:
                            if sb['key'] == bu_key_mapping.alertmap[interlockname]:
                                cmname = sb['value']
                                cmname = "/" + '/'.join(cmname.split('/')[1:])
                                cmddata[cmname] = cmdvalue
                else:
                    isRosov = True if 'rosov' in pumptype else False
                    ispumps = True if 'pumps' in pumptype else False
                    ismov = True if 'mov' in pumptype else False
                    if isPumpShutDown is not None:
                        ispumps = isPumpShutDown

                    print(isRosov, ispumps, ismov, inlet, outlet)
                    # commands = tb.shutdown(devicedata, isRosov, ispumps, ismov, inlet, outlet)
                    if commands:
                        for cmd in commands:
                            if cmd:
                                cmd = "/" + '/'.join(cmd.split('/')[1:])
                                cmddata[cmd] = cmdvalue

            sendTASRQMessage(sapid, {"tagsData": cmddata})
        except Exception as e:
            print("Exception Occured While Sending Command for alert %s ", alert_id)
            print(e)
            print("Traceback %s" % traceback.format_exc())
        return True, {"pendingTanks": [], 'completedTanks': [], 'taskstatus': True}
