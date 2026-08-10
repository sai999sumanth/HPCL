import urdhva_base
import asyncio
import orchestrator.analytics.dry_out_analysis as dry_out_analysis

if __name__ == "__main__":
    asyncio.run(dry_out_analysis.sync_carry_fwd_indent(insert_to_db=True))