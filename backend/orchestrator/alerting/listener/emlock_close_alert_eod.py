import urdhva_base
import asyncio
import orchestrator.analytics.emlock_analysis as emlock_analysis


async def emlock_close_alert_eod():
    await emlock_analysis.close_alerts_by_schedule()



if __name__ == "__main__":
    asyncio.run(emlock_close_alert_eod())