fields_mapping ={
    "resources":["region", "region_name", "availability_zone", "hypervisor", "os_type",
               "cloud_account_id", "resource_type", "architecture", "resource_size"]
}

unsupported_tables = ['metrics']

quick_columns = {
    "metric_type": [
        "BytesDownloaded", "BytesUploaded", "VolumeWriteOps", "mem_used_percent", "UnusedMemory",
        "memory_usage", "NetworkBytesOut", "network_packets_out", "DiskWriteOps", "network_packets_in",
        "network_in", "Requests", "BytesOutToDestination", "packets_drop_count", "volume_read_bytes",
        "5xxErrorRate", "volume_read_iops", "DiskReadOps", "BytesInFromDestination", "NetworkBytesIn",
        "VolumeIdleTime", "4xxErrorRate", "active_connection_count", "cpu_usage", "volume_idle_time",
        "FreeableMemory", "VolumeReadBytes", "network_out", "VolumeReadOps", "VolumeWriteBytes",
        "volume_write_bytes", "memory_free", "volume_write_iops"
        ],
    "alert_status": ['Open', 'Closed', 'ForceOpen', 'ForceClose', 'Suppressed'],
    "cloud_provider": ['AWS', 'Azure', 'GCP', 'OCI'],
    "dashboard_status": ['Draft', 'Published', 'Completed'],
    "type": ['Manual', 'Query', 'AIText'],
    "instance_launch_type": ['SpotInstance', 'ReservedInstance', 'Ec2InstanceSavingPlan',
                             'ReservedInstanceConvertable', 'ComputeSavingsPlan'],
    "recommendation_status": ['Excluding', 'Acted', 'Pending']
}
