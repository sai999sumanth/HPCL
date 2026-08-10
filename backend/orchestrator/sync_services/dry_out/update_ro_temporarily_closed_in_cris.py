import urdhva_base
import asyncio
import orchestrator.analytics.dry_out_analysis as dry_out_analysis


async def update_temporarily_closed_ros():
    await dry_out_analysis.is_ro_temporary_closed()

if __name__=='__main__':
    asyncio.run(update_temporarily_closed_ros())