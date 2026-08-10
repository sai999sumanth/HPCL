import urdhva_base
import asyncio
import orchestrator.analytics.ro_analysis as ro_analysis

if __name__ == '__main__':
    asyncio.run(ro_analysis.ro_va_day_end_closure())