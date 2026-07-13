import React, { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''

const sectionLabels: Record<string, string> = {
  hkStocks: '港股交易服务',
  stockConnect: '沪/深港通（北向交易）',
  usStocks: '美股交易',
  otcDerivatives: '场外衍生品（OTC期权）',
  funds: '资金服务',
  other: '其他服务',
}

function formatRate(rate: number): string {
  if (rate >= 0.01) return `${(rate * 100).toFixed(2)}%`
  if (rate >= 0.001) return `${(rate * 100).toFixed(3)}%`
  return `${(rate * 100).toFixed(4)}%`
}

function renderFeeItem(key: string, item: any): React.ReactElement {
  const label = item.label || key
  let value = ''
  if (item.rate !== undefined) {
    value = formatRate(item.rate)
    if (item.min) value += ` (最低 ${item.currency || ''} ${item.min})`
    if (item.max) value += ` (最高 ${item.currency || ''} ${item.max})`
  } else if (item.amount !== undefined) {
    value = item.amount === 0 ? '免费' : `${item.currency || 'HKD'} ${item.amount}`
    if (item.per) value += `/${item.per}`
  }
  if (item.note) value += ` — ${item.note}`
  if (item.chargedBy) value += ` [${item.chargedBy}]`

  return (
    <tr key={key} className="border-b border-slate-100 hover:bg-slate-50">
      <td className="p-3 text-sm text-slate-700">{label}</td>
      <td className="p-3 text-sm text-slate-900 font-mono">{value}</td>
    </tr>
  )
}

function renderSection(sectionKey: string, section: any): React.ReactElement | null {
  if (!section || typeof section !== 'object') return null
  const title = section.title || sectionLabels[sectionKey] || sectionKey

  const categories: [string, any][] = Object.entries(section).filter(
    ([k]) => k !== 'title' && typeof section[k] === 'object'
  )

  return (
    <div key={sectionKey} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-800">
        <h3 className="text-base font-bold text-white">{title}</h3>
      </div>
      {categories.map(([catKey, catValue]) => {
        if (catValue.label) {
          // Single item
          return (
            <table key={catKey} className="w-full text-sm">
              <tbody>{renderFeeItem(catKey, catValue)}</tbody>
            </table>
          )
        }
        // Category with sub-items
        const catLabel = catKey === 'commission' ? '经纪佣金' : catKey === 'statutory' ? '法定及第三方费用' :
          catKey === 'custody' ? '托管及交收' : catKey === 'corporateActions' ? '企业行动' :
          catKey === 'ipo' ? '新股认购' : catKey
        return (
          <div key={catKey}>
            <div className="px-6 py-2 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">{catLabel}</div>
            <table className="w-full">
              <tbody>
                {Object.entries(catValue).map(([k, v]: [string, any]) => renderFeeItem(k, v))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

export default function FeeSchedule() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/api/fee-schedule`)
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fee Schedule / 服务收费表</h1>
          {data?.version && <p className="text-sm text-slate-500 mt-1">版本: {data.version} · 最后更新: {data.lastUpdated}</p>}
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">加载中...</div>
      ) : data ? (
        <>
          {['hkStocks', 'stockConnect', 'usStocks', 'otcDerivatives', 'funds', 'other'].map(key =>
            data[key] ? renderSection(key, data[key]) : null
          )}
        </>
      ) : (
        <div className="p-12 text-center text-slate-500">暂无收费数据</div>
      )}
    </div>
  )
}
