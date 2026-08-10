# OpcdaSimulator

OpcdaSimulator is a .NET backend service that bridges OPC DA servers with RabbitMQ. It collects real-time industrial data and publishes it to message queues, supporting both production environments and simulated testing scenarios.

## Features
- Real-time OPC DA data collection
- RabbitMQ message brokering
- Configurable data polling strategies
- Simulated data mode
- Fault-tolerant operation
- Detailed logging and local data persistence

## Configuration (`config.json`)

### Location Configuration
- **`location_id`**  
  Unique facility identifier used for:  
  * Loading device config from `{location_id}.json`  
  * RabbitMQ queue naming (`{conn_channel}_{location_id}`)  
  * Local backup file naming (`{location_id}_data.json`)

### RabbitMQ Connection
- **`conn_host`** - Broker hostname/IP  
- **`conn_port`** - AMQP port (default: 5672)  
- **`conn_channel`** - Base queue name prefix  
- **`conn_exchange`** - RabbitMQ exchange name  
- **`conn_user`** - Authentication username  
- **`conn_vhost`** - Virtual host namespace  
- **`conn_secret`** - Authentication password  

*Connection Failure Handling:*  
Application continues operation without RabbitMQ if connection fails.

### OPC DA Configuration
- **`OpcDaIpAddresses`** - List of OPC server IPs  
- **`ProgramId`** - OPC server ProgID (e.g., `Yokogawa.FastToolsOpcDas.13`)

*Connection Strategy:*  
Attempts connections to all IPs sequentially until successful.

### Simulation Mode
- **`opc_simulator_file`**  
  Path to JSON file containing simulated tag values.  
  *Format:* `{ "tags": { "TAG1": "value1", "TAG2": "value2" } }`  
  *Behavior:*  
  - Activates when file exists  
  - Uses file values instead of OPC DA connection  
  - Detects value changes between readings

### Timing Configuration
- **`FullDumpIntervalMinutes`**  
  Full data export interval (minutes)  
  *Default:* 30 minutes between complete dataset exports

- **`ActivePeriodStart`** / **`ActivePeriodEnd`**  
  High-frequency polling window (`HH:mm` format)  
  *Example:* `08:00`-`18:00` for daytime operations

- **`ActivePollingSeconds`**  
  Data collection interval during active period  
  *Typical:* 10 seconds

- **`InactivePollingSeconds`**  
  Collection interval outside active hours  
  *Typical:* 30 seconds

## Data Flow
1. **Configuration Load**  
   - Reads `config.json` and validates settings
   - Loads device/tag mapping from `{location_id}.json`

2. **Data Collection**  
   ```mermaid
   graph TD
     A[Check Simulator File] -->|Exists| B[Read Simulated Values]
     A -->|Missing| C[Connect to OPC DA]
     C --> D[Read Real-time Values]
     B & D --> E[Detect Value Changes]