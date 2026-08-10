import React from 'react'
import { AlertTriangle, Lock, Shield, Clock } from 'lucide-react'

interface StatsData {
  total: number
  blocked: number
  unblocked: number
  waiting_block_confirmation: number
  waiting_sales_stop_confirmation: number
  waiting_unblock_confirmation: number
  waiting_sales_resume_confirmation: number
  manually_unblocked: number
  automatically_unblocked: number
  no_connectivity: number
  pending_unblocks: number
}

interface RetailGovernanceStatsCardsProps {
  stats: StatsData
  loading?: boolean
}

const RetailGovernanceStatsCards: React.FC<RetailGovernanceStatsCardsProps> = ({ stats, loading = false }) => {
  const cards = [
    // {
    //   title: `Total Outlets (${loading ? "..." : stats.total.toLocaleString()})`,
    //   gradient: "from-blue-500 via-blue-600 to-blue-700",
    //   icon: AlertTriangle,
    //   items: [
    //     { label: "Blocked", value: stats.blocked },
    //     { label: "Unblocked", value: stats.unblocked },
    //   ],
    // },
    // {
    //   title: "Waiting Confirmations",
    //   gradient: "from-yellow-500 via-yellow-600 to-yellow-700",
    //   icon: Clock,
    //   items: [
    //     { label: "Waiting Block Confirmation", value: stats.waiting_block_confirmation },
    //     { label: "Waiting Unblock Confirmation", value: stats.waiting_unblock_confirmation },
    //   ],
    // },
    // {
    //   title: "Sales Status",
    //   gradient: "from-orange-500 via-orange-600 to-orange-700",
    //   icon: Lock,
    //   items: [
    //     { label: "Waiting Sales Stop Confirmation", value: stats.waiting_sales_stop_confirmation },
    //     { label: "Waiting Sales Resume Confirmation", value: stats.waiting_sales_resume_confirmation },
    //   ],
    // },
    {
      title: `Total Outlets (${loading ? "..." : stats.total.toLocaleString()})`,
      gradient: "from-blue-500 via-blue-600 to-blue-700",
      icon: Shield,
      items: [
        { label: "No Connectivity", value: stats.no_connectivity },
        { label: "Pending Unblocks", value: stats.pending_unblocks },
      ],
    },
    {
      title: "Unblock Status",
      gradient: "from-green-500 via-green-600 to-green-700",
      icon: Shield,
      items: [
        { label: "DNC Unblocked", value: stats.manually_unblocked },
        { label: "Picture Uploaded", value: stats.automatically_unblocked },
      ],
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
      {cards.map((card, index) => {
        const IconComponent = card.icon
        return (
          <div
            key={index}
            className={`bg-gradient-to-br ${card.gradient} rounded-xl shadow-lg p-3 text-white transform hover:scale-105 transition-all duration-200`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider">{card.title}</h3>
              <IconComponent className="h-4 w-4 text-white/80 mr-1" />
            </div>
            <div className="space-y-1.5">
              {card.items.map((item, itemIndex) => (
                <div key={itemIndex} className="flex justify-between items-center">
                  <span className="text-xs font-medium text-white/90">{item.label}</span>
                  <span className="text-sm font-bold bg-white/20 px-2 py-0 rounded">
                    {loading ? "..." : item.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default RetailGovernanceStatsCards
