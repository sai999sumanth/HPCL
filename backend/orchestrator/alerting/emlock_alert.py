import urdhva_base
import datetime
import hpcl_ceg_model
import urdhva_base.queryparams
import utilities.interlock_mapping
import dateutil.parser as dt_parser
import utilities.emlock_mapping as emlock_mapping
import utilities.interlock_mapping as interlock_mapping
import orchestrator.alerting.alert_helper as alert_helper
import orchestrator.alerting.alert_factory as alert_factory

logger = urdhva_base.logger.Logger.getInstance("emlock_alertmanager")


class EMLockAlertManager(alert_factory.AlertFactory):
    @classmethod
    async def create_bu_alert(cls, alert_data, camunda_url=urdhva_base.settings.camunda_url):
        """
        Converting/Transforming EMLock raw alert data into unique alert data format
        Args:
            alert_data:
            camunda_url:

        Returns:
        """
        print("EmLock alert_data -->", alert_data)
        logger.info(f"EmLock interlock data: {alert_data}")
        status, loc_dt = await alert_helper.get_location_details(bu=alert_data['location_type'], sap_id=alert_data['location_id'])
        if status:
            alert_data['location_data'] = loc_dt
        else:
            logger.info(f"Error in finding location {alert_data['location_id']} "
                        f"for bu {alert_data['location_type']} - {loc_dt}")
            loc_dt = {"name": ""}

        emlock_interlock_details = emlock_mapping.emlock_vehicle_mapping[alert_data['location_type']]

        interlock_details = utilities.interlock_mapping.get_interlock_name(
            alert_data['location_type'],
            emlock_interlock_details[alert_data['exception_type']]['interlock_name'])
        logger.info(f"EmLock interlock data: {interlock_details}")

        exception_msg = (f"Vehicle Number - {alert_data['truck_number']} \n Violation Type - {alert_data['exception_type']} \n"
                         f"Terminal Code - {alert_data['terminal_code']} \n"
                         f"Exception Date - {alert_data['created_datetime']}")

        alert_history = [{
            "action_msg": exception_msg,
            "action_type": "Created",
            "alert_status": "Open"
        }]

        # preparing alert_data for EmLock
        interlock_details.update({"bu": alert_data['location_type'],
                                  "location_name": loc_dt['name'],
                                  "sap_id": alert_data['location_id'],
                                  "severity": emlock_interlock_details[alert_data['exception_type']]['severity'],
                                  "alert_id": alert_data['emlock_exception_id'],
                                  "alert_section": "EMLock",
                                  "alert_history": alert_history,
                                  "vendor_alert_id": alert_data['emlock_exception_id'],
                                  "vehicle_number": alert_data['truck_number'],
                                  "violation_type": alert_data['exception_type'],
                                  "servicing_plant_id": alert_data['terminal_code'],
                                  "dealer_id": alert_data['ro_code'],
                                  "alert_timestamp": datetime.datetime.strptime(alert_data['created_datetime'], "%Y-%m-%d %H:%M:%S").isoformat()
                                  })


        await cls.create_alert(interlock_details, camunda_url)



    @classmethod
    async def create_bu_alert_old(cls, alert_data, camunda_url=urdhva_base.settings.camunda_url):
        """
        Converting/Transforming EMLock raw alert data into unique alert data format
        :param alert_data:
        :param camunda_url:
        :return:
        """
        print("alert_data -->", alert_data)
        recv_time = datetime.datetime.now(tz=datetime.timezone.utc)
        for record in alert_data['data']:
            if record['exception_type'] not in emlock_mapping.emlock_vehicle_mapping:
                continue
            record['location_type'] = 'TAS'
            status, location_details = await alert_helper.get_location_details(record['location_type'],
                                                                                record['location_id'])
            if not status:
                logger.info(f"Error in finding location {record['location_id']} "
                            f"for bu {record['location_type']} - {location_details}")
                continue
            exception_msg = (f"Vehicle Number - {record['vehicle_number']}, Violation Type - {record['exception_type']}"
                             f", Approved By - {record['approved_by']}, "
                             f"Exception Date - {recv_time}")
            query = (f"sap_id='{record['location_id']}' and vehicle_number='{record['vehicle_number']}' "
                     f"and status='Open' and violation_type='{record['exception_type']}'")

            data = await hpcl_ceg_model.EMLock.get_all(urdhva_base.queryparams.QueryParams(q=query, limit=1)
                                                       , resp_type='plain')
            if len(data['data']):
                # Updating existing EM Lock record
                em_lock_record = data['data'][0]
                em_lock_record['violation_history'].append(exception_msg)
                violation_start_date = em_lock_record['violation_start_date']
                if isinstance(violation_start_date, str):
                    violation_start_date = dt_parser.parse(violation_start_date)
                time_period = (recv_time - violation_start_date).days
                if time_period > 15:
                    em_lock_record['violation_count'] = 0
                else:
                    em_lock_record['violation_count'] += 1
                if em_lock_record['violation_count'] > 10:
                    # Create Alert record and class create_alert
                    em_lock_record['violation_count'] = 0
                    em_lock_record['sop_id'] = ''
                    em_lock_record['interlock_name'] = emlock_mapping.emlock_vehicle_mapping[record['exception_type']]['interlock_name']
                    # Interlock name should be respective of voilation type
                    em_lock_record.update(interlock_mapping.get_interlock_name(em_lock_record['bu'],
                                                                                   em_lock_record['interlock_name'], ""))

                    await cls.create_alert(em_lock_record)
                    # Modifying EmLock record data
                await hpcl_ceg_model.EMLock(**em_lock_record).modify()
            else:
                # Creating EM Lock record
                em_lock_record = {"bu": record['location_type'], "sap_id": record['location_id'],
                                  "location_name": location_details['name'], "vehicle_number": record['vehicle_number'],
                                  "violation_type": record['exception_type'],
                                  "violation_count": 1, "status": 'Open', "violation_history": [exception_msg],
                                  "violation_start_date": recv_time}
                await hpcl_ceg_model.EMLockCreate(**em_lock_record).create()

    @classmethod
    async def close_bu_alert(cls, alert_data):
        """
        Close a BU level alert asynchronously.

        Parameters:
            alert_data (dict): A dictionary containing the data to close the alert
                - bu (str): Business unit
                - sap_id (str): SAP ID
                - sop_id (str): SOP ID
                - alert_id (str): Unique alert ID

        Returns:
            dict: A dictionary containing the status, message, and the closed alert document.

        Raises:
            Exception: If the alert is not found or there's an error in closing the alert.
        """
        try:
            logger.info(f"Alert data received to close alert: {alert_data}")
            return await cls.close_alert(alert_data)

        except Exception as e:
            raise Exception(status_code=500, detail="Error closing alert.") from e
