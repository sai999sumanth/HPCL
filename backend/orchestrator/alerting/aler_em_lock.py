import urdhva_base
import datetime
from utilities.sop_configurations import SOP_Configurations

async def emlock_create(data):
    mapdata = SOP_Configurations[data['data'][0]['data'][0]['violation_type']]
    data['data'][0]['sopid'] = mapdata['sopid']
    data['data'][0]['exception_type'] = mapdata['sopname']
    violation_msg = "Dealer Code:%s Vehicle Number:%s Initiated Date:%s Approved By:%s" % (data['data'][0]['vendor_id'],
                                                                                           data['data'][0]['data'][0]['vechical_number'],
                                                                                           data['data'][0]['data'][0]['initiated_date'],
                                                                                           data['data'][0]['data'][0]['approved_by'])


    
    query  = f"\"VehicleNumber\" like '%{data['data'][0]['data'][0]['vechical_number']}%' AND \"ExceptionType\" like '%{data['data'][0]['exception_type']}%'"
    params = urdhva_base.queryparams.QueryParams()
    params.limit = 100
    params.fields = None
    params.q = query
    params.sort = json.dumps({"updated": -1})
    status, existingdoc = await hpcl_ceg_model.EMLock.get_all(params)
    
    if not status or not existingdoc['data']:
        createdoc = {
            "VehicleNumber" : data['data'][0]['data'][0]['vechical_number'].upper(),
            "ExceptionType" : data['data'][0]['exception_type'],
            "TerminalCode": data['data'][0]['TerminalCode'],
            "count": 1,
            "dateoffirstviolation": datetime.datetime.now(datetime.timezone.utc),
            "violationHistory": [violation_msg],
            "DealerCode": data['data'][0]['Dealer_Code']
        }
        return await hpcl_ceg_model.EMLock.create(createdoc)
    else:
        existingdoc = existingdoc['data'][0]
        if (datetime.datetime.now(datetime.timezone.utc) - dateutil.parser.parse(existingdoc["dateoffirstviolation"])).days > 15:
            existingdoc["dateoffirstviolation"] = datetime.datetime.now(datetime.timezone.utc)
            existingdoc["count"] = data["data"][0]["count"]
        else:
            existingdoc["count"] += data["data"][0]["count"]
            if 'violationHistory' not in existingdoc:
                existingdoc['violationHistory'] = []
            existingdoc["violationHistory"].append(violation_msg)

            if existingdoc["count"] >= 10:
                alerthistorymessage = "%s for Vehicle:%s Dealer Code:%s" % (data['data'][0]['exception_type'],
                                                                            data['data'][0]['data'][0]['vechical_number'], data['data'][0]['data'][0]['Dealer_Code'])
                eventuniqid = 'TAS_' + data['data'][0]['data'][0]['TerminalCode'] + '_' + data['data'][0]['data'][0]['Dealer_Code'] + '_' + data['data'][0]['sopid']
                alertdoc = {'interlockName': data['data'][0]['exception_type'], 'unitName': data['data'][0]['data'][0]['TerminalCode'],
                            'plantlocation': data['data'][0]['data'][0]['Dealer_Code'],
                            'message': data['data'][0]['exception_type'] + ' Vehicle Number:%s' % data['data'][0]['data'][0]['vechical_number'],
                            'severity': mapdata['severity'], 'deviceName': 'Sterna', 'business': mapdata['business'],
                            'BU': 'TAS', 'sopid': data['data'][0]['sopid'], 'sapid': doc['TerminalCode'], 'deviceId': 'Sterna',
                            'deviceType': 'sterna', 'staticData': {'alertHistory': existingdoc["violationHistory"],
                                                                   'VehicleNumber': data['data'][0]['data'][0]['vechical_number'],
                                                                   'vendor': data['data'][0]['vendor_id']}}

                tb_alertprocessor.CreateAlert().create({'details': {'additionalInfo': alertdoc},
                                                        'id': {'id': eventuniqid}})
                existingdoc["dateoffirstviolation"] = datetime.datetime.now(datetime.timezone.utc)
                existingdoc["count"] = 0
                existingdoc["violationHistory"] = []

                data_object = hpcl_ceg_model.Emlock(**existingdoc)
                await data_object.modify()
    
    

    
    




    '''
    def create(self, doc):
        mapdata = self.mapping[doc['Exception_Type'].lower()]
        doc['sopid'] = mapdata['sopid']
        doc['exception_type'] = mapdata['sopname']
        violation_msg = "Dealer Code:%s Vehicle Number:%s Initiated Date:%s Approved By:%s" % (doc['Dealer_Code'],
                                                                                               doc['Vechical_Number'],
                                                                                               doc['Initiated_Date'],
                                                                                               doc['Approved_By'])
        query = buildElsQuery({"VehicleNumber.keyword": doc['Vechical_Number'].upper(),
                               "ExceptionType.keyword": doc['exception_type']})
        status, existingdoc = super(LorryCount, self).get_all(query, limit=1, orderBy=[{"updated": {"order": "desc"}}])
        if not status or not existingdoc['data']:
            createdoc = {"VehicleNumber": doc['Vechical_Number'].upper(), "TerminalCode": doc['TerminalCode'],
                         "ExceptionType": doc['exception_type'], "count": 1, "DealerCode": doc['Dealer_Code'],
                         "dateoffirstviolation": datetime.datetime.now(datetime.timezone.utc), "violationHistory": [violation_msg]}
            return super(LorryCount, self).create(createdoc)
        else:
            existingdoc = existingdoc['data'][0]
            if (datetime.datetime.now(datetime.timezone.utc) - dateutil.parser.parse(existingdoc["dateoffirstviolation"])).days > 15:
                existingdoc["dateoffirstviolation"] = datetime.datetime.now(datetime.timezone.utc)
                existingdoc["count"] = doc["count"]
            else:
                existingdoc["count"] += doc["count"]
            if 'violationHistory' not in existingdoc:
                existingdoc['violationHistory'] = []
            existingdoc["violationHistory"].append(violation_msg)

            if existingdoc["count"] >= 10:
                alerthistorymessage = "%s for Vehicle:%s Dealer Code:%s" % (doc['exception_type'],
                                                                            doc['Vechical_Number'], doc['Dealer_Code'])
                eventuniqid = 'TAS_' + doc['TerminalCode'] + '_' + doc['Dealer_Code'] + '_' + doc['sopid']
                alertdoc = {'interlockName': doc['exception_type'], 'unitName': doc['TerminalCode'],
                            'plantlocation': doc['Dealer_Code'],
                            'message': doc['exception_type'] + ' Vehicle Number:%s' % doc['Vechical_Number'],
                            'severity': mapdata['severity'], 'deviceName': 'Sterna', 'business': mapdata['business'],
                            'BU': 'TAS', 'sopid': doc['sopid'], 'sapid': doc['TerminalCode'], 'deviceId': 'Sterna',
                            'deviceType': 'sterna', 'staticData': {'alertHistory': existingdoc["violationHistory"],
                                                                   'VehicleNumber': doc['Vechical_Number'],
                                                                   'vendor': doc['Dealer_Code']}}

                tb_alertprocessor.CreateAlert().create({'details': {'additionalInfo': alertdoc},
                                                        'id': {'id': eventuniqid}})
                existingdoc["dateoffirstviolation"] = datetime.datetime.now(datetime.timezone.utc)
                existingdoc["count"] = 0
                existingdoc["violationHistory"] = []

            return super(LorryCount, self).modify(existingdoc["_id"], existingdoc)'''