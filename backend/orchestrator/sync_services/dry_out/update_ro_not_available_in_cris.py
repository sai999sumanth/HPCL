import urdhva_base
import asyncio
import orchestrator.analytics.dry_out_analysis as dry_out_analysis


async def update_mark_as_false_ro_not_in_cris():
    dry_out_in_days = ["1","2"]
    for dry_out in dry_out_in_days:
        await dry_out_analysis.remove_ro_not_available_in_cris(dry_out_in_days=dry_out)


if __name__=='__main__':
    asyncio.run(update_mark_as_false_ro_not_in_cris())
