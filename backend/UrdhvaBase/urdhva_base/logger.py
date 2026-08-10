"""
Application logger generation
"""

import os
import logging
import urdhva_base
import logging.handlers


class Logger(object):
    """
    Logger class
    """
    _instances = {}

    @classmethod
    def getInstance(cls, logFile=None):
        """
        Logger get instance
        """
        if not logFile:
            raise Exception("Require log file name.")
        if logFile not in Logger._instances:
            Logger._instances[logFile] = Logger(logFile)

        return Logger._instances[logFile].myLogger

    def __init__(self, logFile):
        """
        Logger initilization
        """
        if not os.path.exists(urdhva_base.settings.log_base_dir):
            os.makedirs(urdhva_base.settings.log_base_dir)

        log_file_path = os.path.join(urdhva_base.settings.log_base_dir, logFile + ".log")

        # Set up a specific logger with our desired output level
        self.myLogger = logging.getLogger(logFile)
        self.myLogger.setLevel(logging.DEBUG)

        # Add the log message handler to the logger
        handler = logging.handlers.RotatingFileHandler(log_file_path, maxBytes=urdhva_base.settings.log_max_size,
                                                       backupCount=urdhva_base.settings.log_max_count)
        formatter = logging.Formatter('%(asctime)s %(levelname)s %(module)s %(funcName)s '
                                      '%(lineno)s %(message)s')
        handler.setFormatter(formatter)
        self.myLogger.addHandler(handler)
