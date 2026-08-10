import urdhva_base
import json
import base64
import requests
import orchestrator.dbconnector.credential_loader as credential_loader

logger = urdhva_base.logger.Logger.getInstance("ro_interlock_handler")


class RoInterlockHandler:
    """
    Handles Retail Outlet (RO) blocking and unblocking
    via CRIS Interlock REST APIs.
    """

    # Load credentials once at class load
    credentials = credential_loader.load_credentials("CRIS_INTERLOCK_")

    # ------------------------------------------------------------------
    # CONNECTION DETAILS
    # ------------------------------------------------------------------
    @classmethod
    async def fetch_connection_details(cls):
        """
        Fetch base URL, authorization header and common headers.
        """
        base_url = cls.credentials["CRIS_INTERLOCK_HOST"]

        # Build Basic Auth header safely
        auth_string = (
            f"{cls.credentials['CRIS_INTERLOCK_USERNAME']}:"
            f"{cls.credentials['CRIS_INTERLOCK_PASSWORD']}"
        )
        auth_encoded = base64.b64encode(auth_string.encode()).decode()

        headers = {
            "Authorization": f"{auth_encoded}",
            "Content-Type": "application/json",
            "Vendor": "Novex"
        }

        return base_url, headers

    # ------------------------------------------------------------------
    # COMMON REQUEST HANDLER
    # ------------------------------------------------------------------
    @classmethod
    async def request_handler(cls, endpoint: str, payload: list):
        """
        Sends POST request to CRIS Interlock API.

        NOTE:
        requests.post is synchronous and WILL block the event loop.
        This is acceptable only if calls are infrequent.
        For high concurrency, migrate to aiohttp.
        """
        base_url, headers = await cls.fetch_connection_details()
        url = f"{base_url}{endpoint}"

        try:
            response = requests.post(
                url,
                json=payload,
                headers=headers,
                timeout=30
            )

            if int(response.status_code // 100) != 2:
                logger.error(
                    "CRIS Interlock API failed. Status=%s Response=%s",
                    response.status_code,
                    response.text
                )
                return False, (
                    f"Request failed with status {response.status_code}",
                    response.text
                )
            resp = response.json()
            if not isinstance(resp, list):
                return False, f"Request failed with message {resp}"
            return True, resp

        except Exception as exc:
            logger.exception("Error calling CRIS Interlock API")
            return False, str(exc)

    # ------------------------------------------------------------------
    # INTERNAL RESPONSE PARSER
    # ------------------------------------------------------------------
    @staticmethod
    def _parse_response(resp: list):
        """
        Splits API response into success and failure lists.
        """
        success_list = []
        failed_list = []

        for rec in resp:
            if rec.get("Result") in ("1", 1):
                success_list.append({rec.get("RoCode"): "Success"})
            else:
                failed_list.append({
                    rec.get("RoCode"): rec.get("Message", "Unknown error")
                })

        return success_list, failed_list

    # ------------------------------------------------------------------
    # RO BLOCKING
    # ------------------------------------------------------------------
    @classmethod
    async def ro_blocking(cls, blocking_list: list):
        """
        Blocks a list of Retail Outlets.

        blocking_list: List of RO Codes
        """
        payload = [{"RoCode": ro, "Flag": "1"} for ro in blocking_list]
        endpoint = cls.credentials["CRIS_INTERLOCK_RO_BLOCK_ENDPOINT"]

        status, resp = await cls.request_handler(endpoint, payload)
        if not status:
            return False, resp

        return True, cls._parse_response(resp)

    # ------------------------------------------------------------------
    # RO UNBLOCKING
    # ------------------------------------------------------------------
    @classmethod
    async def ro_unblocking(cls, unblocking_list: list):
        """
        Unblocks a list of Retail Outlets.
        """
        payload = [{"RoCode": ro, "Flag": "0"} for ro in unblocking_list]
        endpoint = cls.credentials["CRIS_INTERLOCK_RO_BLOCK_ENDPOINT"]

        status, resp = await cls.request_handler(endpoint, payload)
        if not status:
            return False, resp

        return True, cls._parse_response(resp)

    # ------------------------------------------------------------------
    # RO + DU INTERLOCK (PLACEHOLDERS)
    # ------------------------------------------------------------------
    @classmethod
    async def ro_du_interlock_block(cls, ro_id, du_id, nozzle_id=None):
        """
        Block a specific DU or nozzle within an RO.
        To be implemented when API contract is finalized.
        """
        raise NotImplementedError("RO-DU interlock block not implemented")

    @classmethod
    async def ro_du_interlock_unblock(cls, ro_id, du_id, nozzle_id=None):
        """
        Unblock a specific DU or nozzle within an RO.
        """
        raise NotImplementedError("RO-DU interlock unblock not implemented")
