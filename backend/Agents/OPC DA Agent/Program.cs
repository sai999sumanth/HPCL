using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using RabbitMQ.Client;
using TitaniumAS.Opc.Client;
using TitaniumAS.Opc.Client.Da;
using RabbitMQ.Client.Events;
using System.Linq;
using System.Threading.Tasks;
using System.Threading;
using System.Net.Http;
using System.Security;
using System.Net.NetworkInformation;
using System.Collections.Concurrent;
using System.Text;
using TitaniumAS.Opc.Client.Common;
using System.Net;
using System.Linq.Expressions;
using System.Diagnostics.Eventing.Reader;
using System.Diagnostics;


namespace OpcdaSimulator
{
    /// <summary>
    ///  Represents the configuration settings for the application
    /// </summary>
    public class ConnectionConfig
    {
        // OPC DA Configuration
        public string location_id { get; set; }   // Unique Indentifier the physical location
        public List<List<string>> OpcDaIpAddresses { get; set; } // List of OPC DA IP Addresses to try
        public string ProgramId { get; set; } // OPC DA Server Program ID (ProgID)
        public string opc_simulator_file { get; set; } // Path to Simulator Json If hard coded  checking Data sending for server to server with out opcda connection


        // Rabbit MQ Configuration
        public string conn_host { get; set; } // RabbitMq Server  hostname
        public string conn_port { get; set; } // RabbitMq Server Port
        public string conn_channel { get; set; } // Base Queue name for Data Messaging
        public string conn_write { get; set; }
        public string conn_exchange { get; set; } // RabbitMQ Data Exchange Name
        public string conn_user { get; set; } // RabbitMQ UserName
        public string conn_vhost { get; set; } // RabbitMQ Virtual host
        public string conn_secret { get; set; } // RabbitMQ password

        // Operational Parameters
        public bool full_dump { get; set; } // Force full data dump flag
        public bool log_debug { get; set; } // Enable debug logging in Console
        public int FullDumpIntervalMinutes { get; set; } // Interval between full data dumps
        public string ActivePeriodStart { get; set; } // Active period start time (HH:MM format)
        public string ActivePeriodEnd { get; set; } // Active period end time (HH:MM format)
        public int ActivePollingSeconds { get; set; } // Polling Interval during active period
        public int InactivePollingSeconds { get; set; } // Polling Interval during outside of active period

        // Log Management Configuration
        public int LogRetentionDays { get; set; } // Number of days to keep log files
        public long MaxLogFileSizeMB { get; set; } // Maximum log file size in MB before creating new file


        // esd activate handle
        public string esd_sensor_name { get; set; }
        public string value { get; set; } // check for Esd tag

        // Status Reporting
        public string status_url { get; set; }
        public int service_status_time { get; set; }
        public int comm_status_time { get; set; }
        public string api_key { get; set; }

        // device json
        public string device_json_url { get; set; }

    }

    /// <summary>
    ///  Represents  a physical device with multiple sensors
    /// </summary>
    public class Device
    {
        public string device_name { get; set; } // Name of the physical device
        public string device_type { get; set; }
        public List<Sensor> sensors { get; set; } // List of the sensors in the device

    }

    /// <summary>
    /// Represents a single sensor with its OPC DA tag mapping
    /// </summary>
    public class Sensor
    {
        public string sensor_name { get; set; } // Human readable tag name
        public string sensor_tag { get; set; } // OPC DA tag name/path
    }

    internal class Program
    {
        // Logging and state management
        private static string logFilePath = $"log_{DateTime.Now:yyyyMMdd_HHmmss_fff}.txt";
        private static readonly Dictionary<string, string> lastKnownTagValues = new Dictionary<string, string>();
        private static DateTime nextFullDumpTime = DateTime.MinValue; // Track next scheduled full dump
        private static bool Debug;

        // Log file management constants 
        private static long MAX_LOG_FILE_SIZE;
        private static int LOG_RETENTION_DAYS;
        private static DateTime lastLogCleanupTime = DateTime.MinValue;
        private static readonly TimeSpan LOG_CLEANUP_INTERVAL = TimeSpan.FromHours(6); // Check every 6 hours


        // ESD Handling
        private static readonly ConcurrentDictionary<string, bool> activeEsdTanks = new ConcurrentDictionary<string, bool>();
        private static readonly Dictionary<string, string> previousEsdStates = new Dictionary<string, string>();


        // RabbitMQ Connections
        private static IConnection rabbitConnection = null;
        private static IModel channel = null;

        // Thread Synchroization
        private static readonly object LogLock = new object();
        static readonly object fileLock = new object();  // Define a lock object
        private static bool isInLogManagement = false; // Prevent recursion

        // Status Track
        private static volatile bool isRunning = true;
        private static bool opcDaHealthy = false;
        private static bool rabbitMqHealthy = false;
        private static volatile bool mainFlowHealthy = true;
        private static DateTime lastOpcFailureTime = DateTime.MinValue;
        private static DateTime lastRabbitFailureTime = DateTime.MinValue;
        private static bool initialConnectionAttemptComplete = false;
        private static readonly object connectionStatusLock = new object();

        // Add persistent OPC DA connection
        private static OpcDaServer activeOpcServer = null;
        private static DateTime lastOpcConnectionAttempt = DateTime.MinValue;
        private static readonly object opcLock = new object();

        private static string writeCommandLogPath = "write_command.txt";

        /// <summary>
        /// Initializes log management settings from configuration
        /// </summary>
        /// <param name="config">Application configuration</param>
        static void InitializeLogSettings(ConnectionConfig config)
        {
            // Convert MB to bytes - no defaults, use config values directly
            MAX_LOG_FILE_SIZE = config.MaxLogFileSizeMB * 1024 * 1024;
            LOG_RETENTION_DAYS = config.LogRetentionDays;

            Console.WriteLine($"Log management initialized - Max file size: {config.MaxLogFileSizeMB}MB, Retention: {LOG_RETENTION_DAYS} days");
        }

        /// <summary>
        /// Manages log file size and performs cleanup of old log files
        /// </summary>
        static void ManageLogFiles()
        {
            // Prevent recursion
            if (isInLogManagement)
                return;

            try
            {
                isInLogManagement = true;

                // Ensure logFilePath is a full path (compatible with .NET Framework)
                if (!Path.IsPathRooted(logFilePath))
                {
                    logFilePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, logFilePath);
                }

                string logDirectory = Path.GetDirectoryName(logFilePath) ?? AppDomain.CurrentDomain.BaseDirectory;

                // Ensure directory exists
                if (!Directory.Exists(logDirectory))
                {
                    Directory.CreateDirectory(logDirectory);
                }

                // Check current log file size
                if (File.Exists(logFilePath))
                {
                    FileInfo currentLogInfo = new FileInfo(logFilePath);
                    if (currentLogInfo.Length >= MAX_LOG_FILE_SIZE)
                    {
                        // Create new log file when current one exceeds size limit
                        string oldLogPath = logFilePath;
                        string newLogFileName = $"log_{DateTime.Now:yyyyMMdd_HHmmss_fff}.txt";
                        logFilePath = Path.Combine(logDirectory, newLogFileName);

                        // Validate the new path by checking for invalid characters
                        char[] invalidChars = Path.GetInvalidPathChars();
                        bool hasInvalidChars = false;
                        foreach (char c in invalidChars)
                        {
                            if (logFilePath.Contains(c))
                            {
                                hasInvalidChars = true;
                                break;
                            }
                        }

                        if (hasInvalidChars)
                        {
                            // Fallback to a simple timestamp if there's an issue
                            newLogFileName = $"log_{DateTime.Now:yyyyMMddHHmmss}.txt";
                            logFilePath = Path.Combine(logDirectory, newLogFileName);
                        }

                        // Use Console.WriteLine instead of LogToFile to prevent recursion
                        Console.WriteLine($"{DateTime.Now:yyyy-MM-dd HH:mm:ss} - Log file size exceeded {MAX_LOG_FILE_SIZE / (1024 * 1024)}MB. Created new log file: {Path.GetFileName(logFilePath)}");
                        Console.WriteLine($"{DateTime.Now:yyyy-MM-dd HH:mm:ss} - Previous log file: {Path.GetFileName(oldLogPath)} (Size: {currentLogInfo.Length / (1024 * 1024)}MB)");
                    }
                }

                // Check for other log files that have reached 500MB and delete them
                CheckAndDeleteOversizedLogFiles(logDirectory);

                // Perform cleanup if enough time has passed
                if (DateTime.Now - lastLogCleanupTime >= LOG_CLEANUP_INTERVAL)
                {
                    CleanupOldLogFiles(logDirectory);
                    lastLogCleanupTime = DateTime.Now;
                }
            }
            catch (Exception ex)
            {
                // Use Console.WriteLine here to avoid potential recursion in LogToFile
                Console.WriteLine($"Error in log file management: {ex.Message}");
                Console.WriteLine($"Current logFilePath: {logFilePath}");
            }
            finally
            {
                isInLogManagement = false;
            }
        }

        /// <summary>
        /// Checks for log files that have reached 500MB and deletes them (except the current active log)
        /// </summary>
        /// <param name="logDirectory">Directory containing log files</param>
        static void CheckAndDeleteOversizedLogFiles(string logDirectory)
        {
            try
            {
                // Validate directory exists
                if (!Directory.Exists(logDirectory))
                {
                    Console.WriteLine($"Log directory does not exist: {logDirectory}");
                    return;
                }

                // Get all log files matching the pattern: log_*.txt
                string[] logFiles = Directory.GetFiles(logDirectory, "log_*.txt");

                int deletedCount = 0;
                long totalDeletedSize = 0;

                foreach (string logFile in logFiles)
                {
                    try
                    {
                        // Skip the current active log file
                        if (string.Equals(Path.GetFullPath(logFile), Path.GetFullPath(logFilePath), StringComparison.OrdinalIgnoreCase))
                            continue;

                        FileInfo fileInfo = new FileInfo(logFile);

                        // Verify it matches our log file pattern: log_yyyyMMdd_HHmmss_fff.txt
                        string fileName = Path.GetFileNameWithoutExtension(fileInfo.Name);
                        if (!fileName.StartsWith("log_") || fileName.Length < 12) // At least log_ + 8 digits minimum
                        {
                            continue; // Skip files that don't match our pattern
                        }

                        // Check if file has reached 500MB limit
                        if (fileInfo.Length >= MAX_LOG_FILE_SIZE)
                        {
                            long fileSize = fileInfo.Length;
                            File.Delete(logFile);
                            deletedCount++;
                            totalDeletedSize += fileSize;

                            Console.WriteLine($"Deleted oversized log file: {fileInfo.Name} (Size: {fileSize / (1024 * 1024)}MB - exceeded 500MB limit)");
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error checking/deleting oversized log file {logFile}: {ex.Message}");
                    }
                }

                if (deletedCount > 0)
                {
                    // Use Console.WriteLine to avoid recursion since this is called from ManageLogFiles
                    Console.WriteLine($"Oversized log cleanup: Deleted {deletedCount} files exceeding 500MB, freed {totalDeletedSize / (1024 * 1024)}MB of disk space");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error during oversized log files check: {ex.Message}");
                Console.WriteLine($"Directory path: {logDirectory}");
            }
        }

        /// <summary>
        /// Deletes log files older than the retention period (2 days) - targets specific log format: log_yyyyMMdd_HHmmss_fff.txt
        /// </summary>
        /// <param name="logDirectory">Directory containing log files</param>
        static void CleanupOldLogFiles(string logDirectory)
        {
            try
            {
                // Validate directory exists
                if (!Directory.Exists(logDirectory))
                {
                    Console.WriteLine($"Log directory does not exist: {logDirectory}");
                    return;
                }

                DateTime cutoffDate = DateTime.Now.AddDays(-LOG_RETENTION_DAYS);

                // Get log files matching the specific pattern: log_*.txt
                string[] logFiles = Directory.GetFiles(logDirectory, "log_*.txt");

                int deletedCount = 0;
                long totalDeletedSize = 0;

                foreach (string logFile in logFiles)
                {
                    try
                    {
                        FileInfo fileInfo = new FileInfo(logFile);

                        // Skip the current active log file
                        if (string.Equals(Path.GetFullPath(logFile), Path.GetFullPath(logFilePath), StringComparison.OrdinalIgnoreCase))
                            continue;

                        // Verify it matches our log file pattern: log_yyyyMMdd_HHmmss_fff.txt
                        string fileName = Path.GetFileNameWithoutExtension(fileInfo.Name);
                        if (!fileName.StartsWith("log_") || fileName.Length < 12) // At least log_ + 8 digits minimum
                        {
                            Console.WriteLine($"Skipping file with unexpected pattern: {fileInfo.Name}");
                            continue;
                        }

                        // Delete log files older than retention period (2 days)
                        if (fileInfo.LastWriteTime < cutoffDate)
                        {
                            long fileSize = fileInfo.Length;
                            File.Delete(logFile);
                            deletedCount++;
                            totalDeletedSize += fileSize;

                            Console.WriteLine($"Deleted old log file: {fileInfo.Name} (Age: {(DateTime.Now - fileInfo.LastWriteTime).Days} days, Size: {fileSize / (1024 * 1024)}MB)");
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error deleting log file {logFile}: {ex.Message}");
                    }
                }

                if (deletedCount > 0)
                {
                    // Use Console.WriteLine instead of LogToFile to prevent recursion
                    Console.WriteLine($"{DateTime.Now:yyyy-MM-dd HH:mm:ss} - Log cleanup completed: Deleted {deletedCount} old log files, freed {totalDeletedSize / (1024 * 1024)}MB of disk space");
                }
                else
                {
                    Console.WriteLine($"{DateTime.Now:yyyy-MM-dd HH:mm:ss} - Log cleanup completed: No old log files found to delete (retention: {LOG_RETENTION_DAYS} days)");
                }

                // Log current log files status
                try
                {
                    var remainingLogFiles = Directory.GetFiles(logDirectory, "log_*.txt")
                        .Select(f => new FileInfo(f))
                        .OrderByDescending(f => f.LastWriteTime)
                        .Take(10); // Show up to 10 most recent log files

                    Console.WriteLine($"{DateTime.Now:yyyy-MM-dd HH:mm:ss} - Current log files:");
                    foreach (var file in remainingLogFiles)
                    {
                        string status = string.Equals(Path.GetFullPath(file.FullName), Path.GetFullPath(logFilePath), StringComparison.OrdinalIgnoreCase) ? " (ACTIVE)" : "";
                        double ageInDays = (DateTime.Now - file.LastWriteTime).TotalDays;
                        Console.WriteLine($"  {file.Name}: {file.Length / (1024 * 1024)}MB, Age: {ageInDays:F1} days, Modified: {file.LastWriteTime:yyyy-MM-dd HH:mm:ss}{status}");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error displaying log files status: {ex.Message}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error during log cleanup: {ex.Message}");
                Console.WriteLine($"Directory path: {logDirectory}");
            }
        }


        /// <summary>
        /// Thread-safe logging mechanism  with file and console output
        /// </summary>
        /// <param name="message">Message to lg</param>
        /// /// <param name="logType">Type of log: "main" (default) or "write"</param>
        static void LogToFile(string message, string LogType = "main")
        {
            string logMessage = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} - {message}";
            string targetLogPath;

            //Determine which log file to use 
            if (LogType == "write")
            {
                targetLogPath = writeCommandLogPath;
            }
            else
            {
                targetLogPath = logFilePath;
            }

            lock (fileLock)  // Lock to prevent simultaneous writes
            {
                try
                {
                    // Check and manage log files before writing (but prevent recursion)
                    if (LogType == "main" && !isInLogManagement)
                    {
                        ManageLogFiles();
                    }

                    // Ensure write command log path is full path
                    if (LogType == "write" && !Path.IsPathRooted(targetLogPath))
                    {
                        targetLogPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, targetLogPath);
                    }


                    using (StreamWriter writer = new StreamWriter(targetLogPath, true, System.Text.Encoding.UTF8, 4096))
                    {
                        writer.WriteLine(logMessage);
                    }
                }
                catch (IOException ex)
                {
                    Console.WriteLine($"Log file write error: {ex.Message}");
                }
            }

            if (Debug)
            {
                lock (LogLock)
                {
                    Console.WriteLine(logMessage);
                }
            }
        }

        /// <summary>
        /// Loads and validates application configuartion
        /// </summary>
        /// <param name="filePath">Path to config.json</param>
        /// <returns>Validated Cofiguartion object</returns>
        /// <exception cref="ArgumentException">Thrown for invalid configuration</exception>
        static ConnectionConfig LoadConfig(string filePath)
        {
            var config = JsonSerializer.Deserialize<ConnectionConfig>(File.ReadAllText(filePath));

            // Validate all required timing parameters
            var validationErrors = new List<string>();

            if (config.FullDumpIntervalMinutes <= 0)
                validationErrors.Add("FullDumpIntervalMinutes must be positive integer");

            if (config.ActivePollingSeconds <= 0)
                validationErrors.Add("ActivePollingSeconds must be positive integer");

            if (config.InactivePollingSeconds <= 0)
                validationErrors.Add("InactivePollingSeconds must be positive integer");

            try
            {
                TimeSpan.Parse(config.ActivePeriodStart);
                TimeSpan.Parse(config.ActivePeriodEnd);
            }
            catch
            {
                validationErrors.Add("ActivePeriodStart/End must be in valid 'HH:mm' format");
            }

            if (validationErrors.Any())
                throw new ArgumentException($"Invalid config: {string.Join(", ", validationErrors)}");

            return config;
        }

        /// <summary>
        /// Establishes connection to RabbitMq server
        /// </summary>
        /// <param name="config">Application Configuartion</param>
        /// <returns>Task with connection success status</returns>
        static Task<bool> TryConnectToRabbitMqAsync(ConnectionConfig config)
        {
            try
            {
                LogToFile("Attempting to connect to data sending server...");

                var factory = new ConnectionFactory
                {
                    HostName = config.conn_host,
                    Port = int.Parse(config.conn_port),
                    UserName = config.conn_user,
                    Password = config.conn_secret,
                    VirtualHost = config.conn_vhost
                };

                rabbitConnection = factory.CreateConnection();
                channel = rabbitConnection.CreateModel();

                string queueName = $"{config.conn_channel}_{config.location_id}";
                channel.QueueDeclare(queue: queueName, durable: true, exclusive: false, autoDelete: false, arguments: null);

                LogToFile("Successfully connected to data sending server");
                rabbitMqHealthy = true;
                return Task.FromResult(true);
            }
            catch (Exception ex)
            {
                rabbitMqHealthy = false;
                lastRabbitFailureTime = DateTime.Now;
                LogToFile($"Failed to connect to Data sending server: {ex.Message}");
                return Task.FromResult(false);
            }
        }

        /// <summary>
        ///  Connects to the first available Opc da server from configured IP addresses
        /// </summary>
        /// <param name="config">Application Configuartion</param>
        /// <returns>Connection or Failures status OPC DA Servers </returns>
        static OpcDaServer ConnectToOpcServer(ConnectionConfig config)
        {
            try
            {
                if (config.OpcDaIpAddresses == null || config.OpcDaIpAddresses.Count != 2)
                    throw new Exception("OPC DA IP addresses must be configured as two groups: LRCA and LRCB.");

                List<string> lrcaIps = config.OpcDaIpAddresses[0];
                List<string> lrcbIps = config.OpcDaIpAddresses[1];
                List<string> allIps = new List<string>();

                // Create list of all IPs in order: saved IP → LRCA IPs → LRCB IPs
                string savedIp = GetSavedIp();
                if (!string.IsNullOrEmpty(savedIp))
                {
                    allIps.Add(savedIp);
                }
                allIps.AddRange(lrcaIps);
                allIps.AddRange(lrcbIps);

                // Track connection attempts
                Exception lastError = null;
                List<string> failedIps = new List<string>();

                LogToFile($"Starting OPC DA connection attempts for {allIps.Distinct().Count()} IPs...");

                lock (connectionStatusLock)
                {
                    // Don't set failure status until we've tried ALL IPs
                    foreach (var ip in allIps.Distinct())
                    {
                        try
                        {
                            LogToFile($"Attempting connection to IP: {ip}");
                            var server = ConnectToSingleIp(ip, config.ProgramId);
                            SaveConnectedIp(ip);
                            LogToFile($"Successfully connected to {ip}");
                            LogToFile($"OPC DA connection established after testing {failedIps.Count + 1} IP(s)");

                            // SUCCESS - Clear any previous failure time and mark as healthy
                            opcDaHealthy = true;
                            lastOpcFailureTime = DateTime.MinValue;
                            initialConnectionAttemptComplete = true;

                            return server;
                        }
                        catch (Exception ex)
                        {
                            failedIps.Add(ip);
                            LogToFile($"Connection to {ip} failed: {ex.Message}");
                            lastError = ex;
                        }
                    }

                    // ONLY set failure status AFTER trying ALL IPs
                    lastOpcFailureTime = DateTime.Now;
                    opcDaHealthy = false;
                    initialConnectionAttemptComplete = true;

                    LogToFile($"ALL OPC DA IPs failed. Total IPs tested: {failedIps.Count}. Failed IPs: [{string.Join(", ", failedIps)}]");
                }

                if (lastError != null)
                {
                    throw new Exception($"Failed to connect to any OPC DA server. Tested {failedIps.Count} IPs: [{string.Join(", ", failedIps)}]", lastError);
                }
                else
                {
                    throw new Exception("No IP addresses available to connect");
                }
            }
            catch (Exception ex)
            {
                LogToFile($"OPC DA connection error: {ex.Message}");
                throw;
            }
        }

        private static OpcDaServer ConnectToSingleIp(string ip, string programId)
        {
            var serverUrl = $"opcda://{ip}/{programId}";
            var server = new OpcDaServer(new Uri(serverUrl));

            // Timeout connection attempt after 60 seconds
            var connectTask = Task.Run(() => server.Connect());
            if (!connectTask.Wait(60000))
            {
                throw new TimeoutException($"Connection to {ip} timed out.");
            }

            if (server.IsConnected)
            {
                LogToFile($"Successfully connected to {ip}");
                return server;
            }
            throw new Exception($"Failed to connect to {ip}");
        }

        private static string GetSavedIp()
        {
            string filePath = "connected_ip.txt";
            if (File.Exists(filePath))
            {
                var line = File.ReadAllText(filePath).Trim();
                if (line.StartsWith("ip="))
                {
                    return line.Substring(3); // remove 'ip='
                }
            }
            return null;
        }


        private static void SaveConnectedIp(string ip)
        {
            File.WriteAllText("connected_ip.txt", $"ip={ip}");
        }

        /// <summary>
        /// Reads current values for all configured tags from OPC DA server
        /// </summary>
        /// <param name="server">List of configured devices</param>
        /// <param name="devices">List of configured devices</param>
        /// <returns>Dictionary of tag values with error handling</returns>
        static Dictionary<string, string> ReadAllTags(OpcDaServer server, List<Device> devices)
        {
            var tagsData = new Dictionary<string, string>();

            try
            {
                var allSensors = devices
                    .SelectMany(d => d.sensors)
                    .Where(s => !string.IsNullOrEmpty(s.sensor_tag))
                    .ToList();

                if (allSensors.Count == 0)
                {
                    LogToFile("No valid sensors found to read");
                    return tagsData;
                }

                using (var group = server.AddGroup("AllTagsGroup"))
                {
                    group.UpdateRate = TimeSpan.FromMilliseconds(100);
                    group.IsActive = true;

                    var itemDefinitions = allSensors.Select(sensor => new OpcDaItemDefinition
                    {
                        ItemId = sensor.sensor_tag,
                        IsActive = true,
                        AccessPath = string.Empty
                    }).ToList();

                    LogToFile($"Adding {itemDefinitions.Count} tags to group");

                    var addResults = group.AddItems(itemDefinitions);
                    var validItems = new List<OpcDaItem>();
                    var validItemToSensor = new Dictionary<OpcDaItem, Sensor>();

                    for (int i = 0; i < addResults.Length; i++)
                    {
                        var result = addResults[i];
                        var sensor = allSensors[i];

                        if (result.Error.Succeeded)
                        {
                            validItems.Add(result.Item);
                            validItemToSensor[result.Item] = sensor;
                        }
                        else
                        {
                            tagsData[sensor.sensor_tag] = "-99";
                            lastKnownTagValues[sensor.sensor_tag] = "-99";
                        }
                    }

                    if (validItems.Count > 0)
                    {
                        LogToFile($"Reading {validItems.Count} valid tags");
                        var readValues = group.Read(validItems.ToArray(), OpcDaDataSource.Device);

                        for (int i = 0; i < readValues.Length; i++)
                        {
                            var item = validItems[i];
                            var value = readValues[i];
                            var sensor = validItemToSensor[item];

                            if (value.Error.Succeeded && value.Value != null)
                            {
                                try
                                {
                                    var valueString = Convert.ToString(value.Value);

                                    if (valueString.Equals("True", StringComparison.OrdinalIgnoreCase))
                                        valueString = "1";
                                    else if (valueString.Equals("False", StringComparison.OrdinalIgnoreCase))
                                        valueString = "0";

                                    if (!lastKnownTagValues.TryGetValue(item.ItemId, out var previousValue) ||
                                        previousValue != valueString)
                                    {
                                        lastKnownTagValues[item.ItemId] = valueString;
                                        tagsData[item.ItemId] = valueString;
                                    }
                                }
                                catch (Exception ex)
                                {
                                    LogToFile($"Error converting value for {item.ItemId}: {ex.Message}");
                                    tagsData[item.ItemId] = "-99";
                                    lastKnownTagValues[item.ItemId] = "-99";
                                }
                            }
                            else
                            {
                                tagsData[item.ItemId] = "-99";
                                lastKnownTagValues[item.ItemId] = "-99";
                            }
                        }
                    }
                    server.RemoveGroup(group);
                }
            }
            catch (Exception ex)
            {
                LogToFile($"Error in batch tag reading: {ex.Message}");
                foreach (var device in devices)
                {
                    foreach (var sensor in device.sensors.Where(s => !string.IsNullOrEmpty(s.sensor_tag)))
                    {
                        tagsData[sensor.sensor_tag] = "-99";
                        lastKnownTagValues[sensor.sensor_tag] = "-99";
                    }
                }
            }

            return tagsData;
        }


        private static async Task SendEsdTankDataThreeTimesAsync(Device tank, ConnectionConfig config)
        {
            try
            {
                for (int i = 0; i < 3; i++)
                {
                    // Collect current data for the Tank's sensors, excluding -99 values
                    var tankData = tank.sensors
                        .Where(s => lastKnownTagValues.TryGetValue(s.sensor_tag, out var value) && value != "-99")
                        .ToDictionary(
                            s => s.sensor_tag,
                            s => lastKnownTagValues[s.sensor_tag]
                        );

                    // Only proceed if we have data to send
                    if (tankData.Any())
                    {
                        // Send to RabbitMQ
                        if (channel != null && channel.IsOpen)
                        {
                            try
                            {
                                string queueName = $"{config.conn_channel}_{config.location_id}";
                                SendToRabbitMq(channel, config.location_id, tankData, queueName);
                                LogToFile($"ESD triggered data sent for Tank {tank.device_name}, iteration {i + 1}");
                            }
                            catch (Exception ex)
                            {
                                LogToFile($"Error sending to RabbitMQ for Tank {tank.device_name}: {ex.Message}");
                                // Continue to next iteration even if this one failed
                            }
                        }
                        else
                        {
                            LogToFile($"RabbitMQ channel not available for Tank {tank.device_name}");
                            break; // Exit the loop if channel is not available
                        }
                    }
                    else
                    {
                        LogToFile($"No valid data to send for Tank {tank.device_name}, iteration {i + 1}");
                    }

                    // Wait 20 seconds except after the last iteration
                    if (i < 2)
                    {
                        await Task.Delay(20000);
                    }
                }
            }
            finally
            {
                // Remove from activeEsdTanks whether successful or not
                activeEsdTanks.TryRemove(tank.device_name, out _);
            }
        }

        /// <summary>
        /// Reads simulated tag values from JSON file with change detection
        /// </summary>
        /// <param name="filePath">Path to simulator JSON file</param>
        /// <returns>Dictionary of changed tag values</returns>
        static Dictionary<string, string> ReadSimulatedTags(string filePath)
        {
            var tagsData = new Dictionary<string, string>();
            try
            {
                LogToFile($"Reading simulated tags");
                var json = File.ReadAllText(filePath);

                using (JsonDocument doc = JsonDocument.Parse(json))
                {
                    var tagsElement = doc.RootElement.GetProperty("tags");
                    foreach (var tag in tagsElement.EnumerateObject())
                    {
                        string newValue = tag.Value.GetString() ?? "-99";

                        // Only include tags that have changed since last reading
                        if (!lastKnownTagValues.TryGetValue(tag.Name, out var previousValue) ||
                            previousValue != newValue)
                        {
                            tagsData[tag.Name] = newValue;
                            lastKnownTagValues[tag.Name] = newValue;  // Update last known value
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                LogToFile($"Error reading simulator file: {ex.Message}");
            }
            return tagsData;
        }

        /// <summary>
        /// Loads device and sensor configuration from JSON file
        /// </summary>
        /// <param name="filePath">Path to device configuration file</param>
        /// <returns>List of configured devices</returns>
        static List<Device> LoadDevices(string filePath, ConnectionConfig config)
        {
            try
            {
                LogToFile("Loading device configuration");
                string fullPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, filePath);

                // Check if file exists locally
                if (!File.Exists(fullPath))
                {
                    // ONLY download if local file NOT available
                    LogToFile($"Local file {filePath} not found. Downloading from API...");
                    DownloadLocationFile(filePath, config);

                    // Verify download was successful
                    if (!File.Exists(fullPath))
                    {
                        throw new Exception("Failed to download device configuration file");
                    }
                }
                else
                {
                    LogToFile($"Using existing local file: {filePath}");
                }

                // Read and parse the JSON file
                string json = File.ReadAllText(fullPath);
                using (JsonDocument doc = JsonDocument.Parse(json))
                {
                    var devices = new List<Device>();
                    var dataArray = doc.RootElement.GetProperty("data");

                    foreach (var deviceElement in dataArray.EnumerateArray())
                    {
                        var device = new Device
                        {
                            device_name = deviceElement.GetProperty("device_name").GetString(),
                            device_type = deviceElement.GetProperty("device_type").GetString(),
                            sensors = new List<Sensor>()
                        };

                        var sensorsArray = deviceElement.GetProperty("sensors");
                        foreach (var sensorElement in sensorsArray.EnumerateArray())
                        {
                            var sensorTag = sensorElement.GetProperty("sensor_tag").GetString();
                            if (!string.IsNullOrEmpty(sensorTag))
                            {
                                device.sensors.Add(new Sensor
                                {
                                    sensor_name = sensorElement.GetProperty("sensor_name").GetString(),
                                    sensor_tag = sensorTag
                                });
                            }
                        }

                        devices.Add(device);
                    }

                    return devices;
                }
            }
            catch (Exception ex)
            {
                mainFlowHealthy = false;
                LogToFile($"Error loading devices configuration: {ex.Message}");
                return new List<Device>();
            }
        }
        static void DownloadLocationFile(string fileName, ConnectionConfig config)
        {
            try
            {
                // Extract location_id from filename (removes .json extension)
                string locationId = Path.GetFileNameWithoutExtension(fileName);

                // Full path where the file will be saved
                string fullPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, fileName);

                // API endpoint to fetch the configuration file
                string apiUrl = $"{config.device_json_url}/{locationId}";
                LogToFile($"Downloading location file from: {apiUrl}");

                // Create handler that ignores SSL certificate errors
                var handler = new HttpClientHandler
                {
                    ServerCertificateCustomValidationCallback = (message, cert, chain, sslPolicyErrors) => true
                };

                using (HttpClient client = new HttpClient(handler))
                {
                    // Add any required headers
                    client.DefaultRequestHeaders.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));

                    // If authentication is required:
                    // client.DefaultRequestHeaders.Add("Authorization", "Bearer YOUR_API_KEY");

                    // Download the file directly to disk
                    using (var response = client.GetAsync(apiUrl).Result)
                    {
                        if (response.IsSuccessStatusCode)
                        {
                            using (var fileStream = new FileStream(fullPath, FileMode.Create, FileAccess.Write, FileShare.None))
                            {
                                response.Content.CopyToAsync(fileStream).Wait();
                            }
                            LogToFile($"Successfully downloaded and saved file to: {fullPath}");
                        }
                        else
                        {
                            throw new Exception($"API returned error: {(int)response.StatusCode} - {response.ReasonPhrase}");
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                LogToFile($"Error downloading location file: {ex.Message}");
                throw; // Re-throw to be caught by the calling method
            }
        }

        /// <summary>
        /// Publishes tag data to RabbitMQ queue
        /// </summary>
        /// <param name="channel">RabbitMQ channel</param>
        /// <param name="locationId">Location identifier</param>
        /// <param name="tagsData">Tag values to send</param>
        /// <param name="queueName">Target queue name</param>
        static void SendToRabbitMq(IModel channel, string locationId, Dictionary<string, string> tagsData, string queueName)
        {
            try
            {
                var data = new { location_id = locationId, tags_data = tagsData };
                var messageBody = JsonSerializer.Serialize(data);
                var body = System.Text.Encoding.UTF8.GetBytes(messageBody);

                channel.BasicPublish(
                    exchange: "",
                    routingKey: queueName,
                    basicProperties: null,
                    body: body
                );
                Console.WriteLine("Tags data are posted to DATA RECEIVER");
                LogToFile($"Successfully published tags to Data Receiving server");
            }
            catch (Exception ex)
            {
                Console.WriteLine("Failed to send the data to DATA RECEIVER");
                LogToFile($"Failed to send data to : {ex.Message}");
            }
        }


        /// <summary>
        /// Simulates OPC DA write operations (stubbed implementation)
        /// </summary>
        /// <param name="server">OPC DA server (unused in simulation)</param>
        /// <param name="tagName">Target tag name</param>
        /// <param name="value">Value to write</param>
        /// <returns>Completed task</returns>
        static Task WriteToOpcDaTagAsync(OpcDaServer server, string tagName, string value)
        {
            //LogToFile($"write sensor_tag:{tagName}, value:{value}");
            // return Task.CompletedTask;
            try
            {
                if (server == null)
                {
                    LogToFile("Error: OPC DA server is not connected.", "write");
                    return Task.CompletedTask;
                }

                LogToFile("Creating OPC DA group for writing...", "write");
                LogToFile($"STARTING WRITE OPERATION - Tag: {tagName}, Value: {value}", "write");
                using (var writeGroup = server.AddGroup($"WriteGroup_{DateTime.Now.Ticks}"))
                {
                    writeGroup.IsActive = true;

                    var itemDefinitions = new List<OpcDaItemDefinition>
             {
                 new OpcDaItemDefinition { ItemId = tagName }
             };

                    OpcDaItemResult[] itemResults = writeGroup.AddItems(itemDefinitions);

                    if (itemResults.Length == 0)
                    {
                        LogToFile($"Failed to add item for writing {tagName}: No items added", "write");
                        return Task.CompletedTask;
                    }

                    // Convert value to Boolean for 1/0, otherwise treat it as a string
                    object convertedValue;
                    if (value == "1")
                        convertedValue = true;
                    else if (value == "0")
                        convertedValue = false;
                    else
                        convertedValue = value;

                    // Perform write operation
                    HRESULT[] writeResults = writeGroup.Write(new[] { writeGroup.Items[0] }, new[] { convertedValue });

                    if (writeResults[0].Succeeded)
                    {
                        LogToFile($"Successfully wrote value {value} to tag {tagName}", "write");

                        // Now read back the value to confirm
                        OpcDaItemValue[] readValues = writeGroup.Read(writeGroup.Items, OpcDaDataSource.Device);
                        if (readValues.Length > 0)
                        {
                            var readValue = readValues[0].Value;
                            LogToFile($"Read back tag {tagName}: Value = {readValue}", "write");
                        }
                        else
                        {
                            LogToFile($"Read failed: No data returned for tag {tagName}", "write");
                        }
                    }
                    else
                    {
                        LogToFile($"Failed to write to tag {tagName}: {writeResults[0]}", "write");

                    }
                }
            }
            catch (Exception ex)
            {
                LogToFile($"Error writing to OPC DA tag {tagName}: {ex.Message}", "write");

            }

            return Task.CompletedTask;

        }

        /// <summary>
        /// Creates communication status object with detailed connection health information
        /// </summary>
        static object CreateCommunicationStatusObject(ConnectionConfig config)
        {
            string opcDaStatus;
            string lastOpcFailureStr = null;

            if (!initialConnectionAttemptComplete)
            {
                opcDaStatus = "connecting"; // Still trying to connect
            }
            else
            {
                opcDaStatus = opcDaHealthy ? "success" : "failed";

                // Handle OPC failure timestamp only after initial attempt is complete
                if (!opcDaHealthy && lastOpcFailureTime != DateTime.MinValue)
                {
                    lastOpcFailureStr = lastOpcFailureTime.ToString("yyyy-MM-dd HH:mm:ss");
                }
            }

            string dataReceivingStatus = rabbitMqHealthy ? "success" : "failed";
            string overallStatus = (opcDaHealthy && rabbitMqHealthy && mainFlowHealthy && initialConnectionAttemptComplete) ? "success" : "failed";

            var statusMessages = new List<string>();
            if (!mainFlowHealthy)
                statusMessages.Add("Configuration issues detected");
            if (!initialConnectionAttemptComplete)
                statusMessages.Add("Initial OPC connection attempt in progress");
            else if (!opcDaHealthy)
                statusMessages.Add("OPC DA connection failed to all IPs");
            if (!rabbitMqHealthy)
                statusMessages.Add("Data receiving connection failed");

            string message = statusMessages.Any()
                ? string.Join(", ", statusMessages)
                : "All systems operational";

            // Handle RabbitMQ failure timestamp
            string lastRabbitFailureStr = null;
            if (!rabbitMqHealthy)
            {
                lastRabbitFailureStr = lastRabbitFailureTime != DateTime.MinValue
                    ? lastRabbitFailureTime.ToString("yyyy-MM-dd HH:mm:ss")
                    : "Never connected";
            }

            return new
            {
                sap_id = config.location_id,
                status = overallStatus,
                message = message,
                opcda_status = opcDaStatus,
                data_receiving_status = dataReceivingStatus,
                configuration_healthy = mainFlowHealthy.ToString(),
                last_opc_failure = lastOpcFailureStr,
                last_rabbit_failure = lastRabbitFailureStr,
            };
        }

        /// <summary>
        /// Creates service status object
        /// </summary>
        static object CreateServiceStatusObject(ConnectionConfig config)
        {
            // Check overall health: agent running AND all components healthy
            bool isServiceHealthy = isRunning && opcDaHealthy && rabbitMqHealthy && mainFlowHealthy;

            // Build detailed status message
            string statusMessage;
            if (!isRunning)
            {
                statusMessage = "Agent Stopped";
            }

            else if (!opcDaHealthy || !rabbitMqHealthy || !mainFlowHealthy)
            {
                // List which components failed
                var failedComponents = new List<string>();
                if (!opcDaHealthy) failedComponents.Add("OPC DA");
                if (!rabbitMqHealthy) failedComponents.Add("RabbitMQ");
                if (!mainFlowHealthy) failedComponents.Add("Configuration");

                statusMessage = $"Agent Running - Component failures: {string.Join(", ", failedComponents)}";
            }
            else
            {
                statusMessage = "Agent Running - All systems operational";
            }





            return new
            {
                sap_id = config.location_id,
                message = statusMessage,
                status = isServiceHealthy ? "success" : "failed", 
            };
        }

        static Task StartStatusReporters(ConnectionConfig config)
        {
            // Start communication status reporter
            _ = Task.Run(async () =>
            {
                var handler = new HttpClientHandler
                {
                    ServerCertificateCustomValidationCallback = (message, cert, chain, sslPolicyErrors) => true
                };

                using (var httpClient = new HttpClient(handler))
                {

                    if (!string.IsNullOrEmpty(config.api_key))
                    {
                        httpClient.DefaultRequestHeaders.Add("vendor","hpcl_tas");
                        httpClient.DefaultRequestHeaders.Add("ceg-auth-token", config.api_key);
                    }
                    // WAIT for initial connection attempt to complete
                    while (!initialConnectionAttemptComplete && isRunning)
                    {
                       
                        await Task.Delay(1000);
                    }

                    while (isRunning)
                    {
                        try
                        {
                            if (string.IsNullOrEmpty(config.status_url))
                            {
                                await Task.Delay(TimeSpan.FromMinutes(config.comm_status_time));
                                continue;
                            }

                            string commStatusUrl = $"{config.status_url}/api/tas/get_agent_comm_status";

                            lock (connectionStatusLock)
                            {
                                var commStatus = CreateCommunicationStatusObject(config);

                                var content = new StringContent(
                                    JsonSerializer.Serialize(commStatus),
                                    Encoding.UTF8,
                                    "application/json");

                                var response = httpClient.PostAsync(commStatusUrl, content).Result;

                                if (response.IsSuccessStatusCode)
                                {
                                    LogToFile($"Communication status sent: {response.StatusCode} - " +
                                              $"OPC: {((dynamic)commStatus).opcda_status}, " +
                                              $"RabbitMQ: {((dynamic)commStatus).data_receiving_status}");
                                }
                                else
                                {
                                    LogToFile($"Communication status sending failed: {response.StatusCode}");
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            LogToFile($"Communication status error: {ex.Message}");
                        }

                        await Task.Delay(TimeSpan.FromMinutes(config.comm_status_time));
                    }
                }
            });

            // Start service status reporter  
            _ = Task.Run(async () =>
            {
                var handler = new HttpClientHandler
                {
                    ServerCertificateCustomValidationCallback = (message, cert, chain, sslPolicyErrors) => true
                };

                using (var httpClient = new HttpClient(handler))
                {

                    if (!string.IsNullOrEmpty(config.api_key))

                    {
                        httpClient.DefaultRequestHeaders.Add("vendor", "hpcl_tas");
                        httpClient.DefaultRequestHeaders.Add("ceg-auth-token", config.api_key);
                    }

                    while (!initialConnectionAttemptComplete && isRunning)
                    {

                        await Task.Delay(1000);
                    }

                    while (isRunning)
                    {
                        try
                        {
                            await SendServiceStatus(httpClient, config);
                        }
                        catch (Exception ex)
                        {
                            LogToFile($"Service status error: {ex.Message}");
                        }

                        await Task.Delay(TimeSpan.FromMinutes(config.service_status_time));
                    }
                }
            });

            return Task.CompletedTask;
        }

        /// <summary>
        /// Sends service status to the service endpoint
        /// </summary>
        static async Task SendServiceStatus(HttpClient httpClient, ConnectionConfig config)
        {
            try
            {
                if (string.IsNullOrEmpty(config.status_url)) return;

                // Use hardcoded endpoint for service status
                string serviceStatusUrl = $"{config.status_url}/api/tas/get_agent_service_status";
                var serviceStatus = CreateServiceStatusObject(config);

                var content = new StringContent(
                    JsonSerializer.Serialize(serviceStatus),
                    Encoding.UTF8,
                    "application/json");

                var response = await httpClient.PostAsync(serviceStatusUrl, content);

                if (response.IsSuccessStatusCode)
                {
                    LogToFile($"Service status sent: {((dynamic)serviceStatus).status}");
                }
                else
                {
                    LogToFile($"Service status sending failed: {response.StatusCode}");
                }
            }
            catch (Exception ex)
            {
                LogToFile($"Service status reporting error: {ex.Message}");
            }
        }

        /// <summary>
        /// Updates connection health states with proper failure tracking
        /// </summary>
        static void UpdateConnectionHealth()
        {
            // OPC DA health check
            lock (opcLock)
            {
                bool wasHealthy = opcDaHealthy;
                opcDaHealthy = activeOpcServer != null && activeOpcServer.IsConnected;

                if (wasHealthy && !opcDaHealthy)
                {
                    LogToFile("OPC DA connection health changed → failed");
                    lastOpcFailureTime = DateTime.Now;
                }
                else if (!wasHealthy && opcDaHealthy)
                {
                    LogToFile("OPC DA connection restored");
                    lastOpcFailureTime = DateTime.MinValue;
                }
            }

            // RabbitMQ health check
            bool wasRabbitHealthy = rabbitMqHealthy;
            rabbitMqHealthy = channel != null && channel.IsOpen &&
                              rabbitConnection != null && rabbitConnection.IsOpen;

            if (wasRabbitHealthy && !rabbitMqHealthy)
            {
                LogToFile("Data Receiving connection health changed → failed");
                lastRabbitFailureTime = DateTime.Now;
            }
            else if (!wasRabbitHealthy && rabbitMqHealthy)
            {
                LogToFile("Data Receiving connection restored");
                lastRabbitFailureTime = DateTime.MinValue;
            }
        }


        /// <summary>
        /// to reset failure times when connections are successful
        /// </summary>
        static void ResetConnectionFailureTimes()
        {
            lock (opcLock)
            {
                if (opcDaHealthy && activeOpcServer != null && activeOpcServer.IsConnected)
                {
                    // Reset OPC failure time only when we have a successful connection
                    if (lastOpcFailureTime != DateTime.MinValue)
                    {
                        LogToFile("OPC DA connection restored - clearing failure timestamp");
                        lastOpcFailureTime = DateTime.MinValue;
                    }
                }
            }

            if (rabbitMqHealthy && channel != null && channel.IsOpen)
            {
                // Reset RabbitMQ failure time only when we have a successful connection  
                if (lastRabbitFailureTime != DateTime.MinValue)
                {
                    LogToFile("RabbitMQ connection restored - clearing failure timestamp");
                    lastRabbitFailureTime = DateTime.MinValue;
                }
            }
        }
        /// <summary>
        /// Starts continuous RabbitMQ command listener
        /// </summary>
        /// <param name="config">Application configuration</param>
        static void StartRabbitMqListener(ConnectionConfig config)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    var factory = new ConnectionFactory
                    {
                        HostName = config.conn_host,
                        Port = int.Parse(config.conn_port),
                        UserName = config.conn_user,
                        Password = config.conn_secret,
                        VirtualHost = config.conn_vhost
                    };

                    while (true)
                    {
                        try
                        {
                            using (var connection = factory.CreateConnection())
                            using (var channel = connection.CreateModel())
                            {
                                string queueName = $"{config.conn_write}_{config.location_id}";

                                try
                                {
                                    channel.QueueDeclare(
                                        queue: queueName,
                                        durable: true,
                                        exclusive: false,
                                        autoDelete: false
                                    );
                                }
                                catch (Exception ex)
                                {
                                    LogToFile($"Queue declaration error: {ex.Message}");
                                    continue;
                                }

                                var consumer = new EventingBasicConsumer(channel);
                                consumer.Received += async (model, ea) =>
                                {
                                    try
                                    {
                                        var body = ea.Body.ToArray();
                                        var message = System.Text.Encoding.UTF8.GetString(body);
                                        LogToFile($"Command Data ---> {message}", "write");

                                        using (JsonDocument doc = JsonDocument.Parse(message))
                                        {
                                            var root = doc.RootElement;

                                            if (root.TryGetProperty("command", out JsonElement commandElement) &&
                                                root.TryGetProperty("sensor_tag", out JsonElement tagElement))
                                            {
                                                string command = commandElement.GetString();
                                                string sensorTag = tagElement.GetString();

                                                if (root.TryGetProperty("value", out JsonElement valueElement))
                                                {
                                                    string value = valueElement.GetString();
                                                    var opcServer = ConnectToOpcServer(config);
                                                    await WriteToOpcDaTagAsync(opcServer, sensorTag, value);
                                                }
                                            }
                                            else
                                            {
                                                LogToFile("Invalid command message format");
                                            }
                                        }

                                        channel.BasicAck(ea.DeliveryTag, false);
                                    }
                                    catch (Exception ex)
                                    {
                                        LogToFile($"Error processing message: {ex.Message}");
                                        channel.BasicAck(ea.DeliveryTag, false);
                                    }
                                };

                                channel.BasicConsume(
                                    queue: queueName,
                                    autoAck: false,
                                    consumer: consumer
                                );

                                LogToFile($"Listener started for queue: {queueName}");

                                while (connection.IsOpen)
                                {
                                    await Task.Delay(1000);
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            LogToFile($"Connection error in listener: {ex.Message}");
                            await Task.Delay(5000);
                        }
                    }
                }
                catch (Exception ex)
                {
                    LogToFile($"Critical error in RabbitMQ Listener: {ex.Message}");
                }
            });
        }


        /// <summary>
        /// Calculates next full dump time based on configured interval
        /// </summary>
        /// <param name="currentTime">Current timestamp</param>
        /// <param name="config">Application configuration</param>
        /// <returns>DateTime for next full dump</returns>
        // Calculate next half-hour interval
        private static DateTime GetNextHalfHour(DateTime currentTime, ConnectionConfig config)
        {
            if (config.FullDumpIntervalMinutes <= 0)
                throw new Exception("Invalid FullDumpIntervalMinutes in config");
            double intervals = currentTime.TimeOfDay.TotalMinutes / config.FullDumpIntervalMinutes;
            DateTime nextDump = currentTime.Date.AddMinutes(Math.Ceiling(intervals) * config.FullDumpIntervalMinutes);

            return nextDump <= currentTime ? nextDump.AddMinutes(config.FullDumpIntervalMinutes) : nextDump;
        }

        /// <summary>
        /// Determines appropriate polling interval based on active period
        /// </summary>
        /// <param name="config">Application configuration</param>
        /// <returns>TimeSpan representing polling interval</returns>
        /// <exception cref="ArgumentException">Thrown for invalid time formats</exception>
        // Determine polling interval based on time of the day                        
        private static TimeSpan GetDelayInterval(ConnectionConfig config)
        {
            // Validate configuration
            if (config.ActivePollingSeconds <= 0 || config.InactivePollingSeconds <= 0)
                throw new ArgumentException("Invalid polling seconds in config");

            try
            {
                TimeSpan now = DateTime.Now.TimeOfDay;
                TimeSpan start = TimeSpan.Parse(config.ActivePeriodStart);
                TimeSpan end = TimeSpan.Parse(config.ActivePeriodEnd);

                return (now >= start && now <= end) ?
                    TimeSpan.FromSeconds(config.ActivePollingSeconds) :
                    TimeSpan.FromSeconds(config.InactivePollingSeconds);
            }
            catch (FormatException ex)
            {
                throw new ArgumentException("Invalid time format in ActivePeriodStart/End", ex);
            }
        }

        /// <summary>
        /// Main application entry point
        /// </summary>
        static async Task Main(string[] args)
        {
            try
            {
                var config = LoadConfig("config.json");
                // Initialize log settings from configuration
                InitializeLogSettings(config);
                Debug = config.log_debug;
                nextFullDumpTime = GetNextHalfHour(DateTime.Now, config);
                bool isFirstRun = true;
                StartRabbitMqListener(config);
                bool isRabbitMqConnected = await TryConnectToRabbitMqAsync(config);

                _ = StartStatusReporters(config);


                while (true)
                {
                    //mainFlowHealthy = true;  // Reset flag at start of each cycle

                    try
                    {
                        // Add RabbitMQ reconnection check here
                        if (!rabbitMqHealthy || channel == null || !channel.IsOpen)
                        {
                            rabbitMqHealthy = await TryConnectToRabbitMqAsync(config);
                        }

                        // OPC DA Connection Management
                        lock (opcLock)
                        {
                            if (activeOpcServer == null || !activeOpcServer.IsConnected)
                            {
                                try
                                {
                                    if (activeOpcServer != null)
                                    {
                                        activeOpcServer.Dispose();
                                        activeOpcServer = null;
                                    }

                                    LogToFile("Attempting OPC DA connection...");
                                    activeOpcServer = ConnectToOpcServer(config);
                                    lastOpcConnectionAttempt = DateTime.Now;
                                    opcDaHealthy = activeOpcServer != null && activeOpcServer.IsConnected;
                                    if (opcDaHealthy)
                                    {
                                        // Reset failure time on successful connection
                                        lastOpcFailureTime = DateTime.MinValue;
                                    }
                                }
                                catch (Exception ex)
                                {

                                    LogToFile($"OPC connection failed: {ex.Message}");
                                    opcDaHealthy = false;
                                    activeOpcServer = null;


                                }
                            }
                        }

                        UpdateConnectionHealth();

                        // Reset failure times when connections are healthy
                        ResetConnectionFailureTimes();

                        var currentTime = DateTime.Now;
                        bool sendFullDump = isFirstRun || config.full_dump || currentTime >= nextFullDumpTime;

                        var devices = LoadDevices($"{config.location_id}.json", config);
                        var changedTagsData = new Dictionary<string, string>();

                        if (File.Exists(config.opc_simulator_file))
                        {
                            // SIMULATED TAGS HANDLING
                            var simulatedData = ReadSimulatedTags(config.opc_simulator_file);
                            // Always update last known values from simulator
                            foreach (var tag in simulatedData)
                            {
                                lastKnownTagValues[tag.Key] = tag.Value;
                            }
                            // For simulated tags, consider all tags as "changed"
                            changedTagsData = new Dictionary<string, string>(simulatedData);
                        }
                        else if (opcDaHealthy && activeOpcServer != null)

                        {
                            try
                            {
                                // Read tags using persistent connection
                                changedTagsData = ReadAllTags(activeOpcServer, devices);


                            }
                            catch (Exception ex)
                            {
                                LogToFile($"Read error: {ex.Message}");
                                lock (opcLock)
                                {
                                    activeOpcServer?.Dispose();
                                    activeOpcServer = null;
                                    opcDaHealthy = false;
                                    lastOpcFailureTime = DateTime.Now;
                                }
                            }
                        }

                        var dataToSend = (sendFullDump ? new Dictionary<string, string>(lastKnownTagValues) : changedTagsData)
                                 .Where(kv => kv.Value != "-99") // Filter out "-99" 
                                 .ToDictionary(kv => kv.Key, kv => kv.Value);

                        foreach (var device in devices)
                        {
                            if (device.device_type == "Tank")
                            {
                                var esdSensor = device.sensors.FirstOrDefault(s => s.sensor_name == config.esd_sensor_name);
                                if (esdSensor != null)
                                {
                                    string currentEsdValue = lastKnownTagValues.TryGetValue(esdSensor.sensor_tag, out var esdVal)
                                        ? esdVal
                                        : "-99";
                                    previousEsdStates.TryGetValue(device.device_name, out var previousEsdValue);

                                    if (currentEsdValue == config.value && previousEsdValue != config.value)
                                    {
                                        if (activeEsdTanks.TryAdd(device.device_name, true))
                                        {
                                            _ = SendEsdTankDataThreeTimesAsync(device, config);
                                        }
                                    }
                                    previousEsdStates[device.device_name] = currentEsdValue;
                                }
                            }
                        }

                        if (sendFullDump)
                        {
                            LogToFile($"Scheduled full dump at {currentTime:HH:mm:ss}");
                            nextFullDumpTime = GetNextHalfHour(currentTime, config);
                        }

                        if (isRabbitMqConnected && channel != null && channel.IsOpen)
                        {
                            string queueName = $"{config.conn_channel}_{config.location_id}";
                            SendToRabbitMq(channel, config.location_id, dataToSend, queueName);
                        }

                        var outputPath = Path.Combine(
                            AppDomain.CurrentDomain.BaseDirectory,
                            $"{config.location_id}_data.json"
                        );
                        File.WriteAllText(outputPath, JsonSerializer.Serialize(new
                        {
                            location_id = config.location_id,
                            tags_data = sendFullDump ? lastKnownTagValues : changedTagsData,
                        }));

                        // Turn off first run flag after completing first cycle
                        isFirstRun = false;
                    }
                    catch (Exception ex)
                    {
                        LogToFile($"Error during monitoring cycle: {ex.Message}");
                    }

                    var delay = GetDelayInterval(config);
                    LogToFile($"Waiting for {delay.TotalSeconds} seconds before next monitoring cycle...");
                    await Task.Delay(delay);
                }
            }
            catch (Exception ex)
            {
                mainFlowHealthy = false;
                LogToFile($"Critical error: {ex.Message}");
                LogToFile($"Stack trace: {ex.StackTrace}");
            }
            finally
            {
                isRunning = false;
                channel?.Dispose();
                rabbitConnection?.Dispose();
            }
        }
    }
}