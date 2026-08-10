import urdhva_base
import os
import ssl
import smtplib
import mimetypes
from email import encoders
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from email.mime.audio import MIMEAudio
from email.mime.multipart import MIMEMultipart
import orchestrator.notification_manager.notification_manager as notification_manager


class NotifyEMail(notification_manager.NotificationManager):
    def __init__(self):
        super().__init__()
        self.notification_type = "Email"

    @classmethod
    def load_credentials(cls):
        """
        Function to load credentials
        :return:
        """
        creds = {"username": urdhva_base.settings.smtp_username, "password": urdhva_base.settings.smtp_password,
                 "port": urdhva_base.settings.smtp_port, "server": urdhva_base.settings.smtp_host,
                 "from": urdhva_base.settings.smtp_from_url,
                 "connection_type": "SSL/TLS" if urdhva_base.settings.smtp_ssl_enabled else "STARTTLS"
                 if urdhva_base.settings.smtp_tls_enabled else None}
        return creds

    @classmethod
    def _attach_file(cls, filename):
        """Attach a file to the email."""
        if not os.path.isfile(filename):
            return

        ctype, encoding = mimetypes.guess_type(filename)
        ctype = ctype if ctype and not encoding else 'application/octet-stream'
        maintype, subtype = ctype.split('/', 1)

        with open(filename, 'rb') as f:
            if maintype == 'text':
                attachment = MIMEText(f.read().decode(), _subtype=subtype)
            elif maintype == 'image':
                attachment = MIMEImage(f.read(), _subtype=subtype)
            elif maintype == 'audio':
                attachment = MIMEAudio(f.read(), _subtype=subtype)
            else:
                attachment = MIMEBase(maintype, subtype)
                attachment.set_payload(f.read())
                encoders.encode_base64(attachment)

            attachment.add_header('Content-Disposition', 'attachment', filename=os.path.basename(filename))
            return attachment

    def publish_message(self, **kwargs):
        """
        Handles the actual email sending process
        :param kwargs:
        :return:
        Example Data
        for plain email
        ---------------------------------------------------------------------------------------------------------
        args = {'to_emails': ['user@email.com'], 'subject': 'test email', 'body': 'test body'}
        ---------------------------------------------------------------------------------------------------------
        for attachments
        ---------------------------------------------------------------------------------------------------------
        args = {'to_emails': ['user@email.com'], 'subject': 'test email', 'body': 'test body', 'attachments': [...]}
        ---------------------------------------------------------------------------------------------------------
        for html content
        ---------------------------------------------------------------------------------------------------------
        args = {'to_emails': ['user@email.com'], 'subject': 'test email', 'body': '<HTML Body>', 'html_content': True}
        ---------------------------------------------------------------------------------------------------------
        """
        creds = self.load_credentials()

        recipients = [kwargs['to_emails']] if isinstance(kwargs['to_emails'], str) else kwargs['to_emails'] or []

        mail_content = MIMEMultipart('alternative' if creds.get("html_content") else 'mixed')
        mail_content['Subject'] = kwargs['subject']
        mail_content['To'] = ",".join(kwargs['to_emails'])
        mail_content['From'] = kwargs.get("from", creds['from'])
        # Reply to email
        if creds.get("reply_to"):
            mail_content['Reply-To'] = creds['reply_to']
        mail_content.attach(MIMEText(kwargs['body'], 'html' if kwargs.get("html_content") else 'plain'))
        # Attaching files if any attachments
        for file_name in kwargs.get("attachments", []):
            mail_content.attach(self._attach_file(file_name))
        try:
            context = ssl.create_default_context()
            if creds['connection_type'] == "SSL/TLS":
                server = smtplib.SMTP_SSL(creds['server'], creds['port'], context=context)
            else:
                server = smtplib.SMTP(creds['server'], creds['port'])
                if creds['connection_type'] == "STARTTLS":
                    server.ehlo()
                    server.starttls(context=context)
                    server.ehlo()
            if creds.get('username') and creds.get("password"):
                server.login(creds['username'], creds['password'])
            server.sendmail(kwargs.get("from", creds['from']), recipients, mail_content.as_string())
            server.quit()
            return {"status": "success", "message": "Email sent successfully."}

        except smtplib.SMTPAuthenticationError:
            return {"status": "failed", "message": "Authentication Error: Invalid Username or Password."}
        except smtplib.SMTPException as e:
            return {"status": "failed", "message": f"SMTP Error: {e}"}
        except ssl.SSLError as e:
            return {"status": "failed", "data": f"SSL Error {e}"}
        except OSError as e:
            return {"status": "failed", "data": str(e)}
        except Exception as e:
            return {"status": "failed", "message": f"Unexpected Error: {e}"}

