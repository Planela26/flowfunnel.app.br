'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ComparisonChartProps {
  title: string
  data: Array<{
    name: string
    [key: string]: string | number
  }>
  bars: Array<{
    dataKey: string
    name: string
    color: string
  }>
}

export default function ComparisonChart({ title, data, bars }: ComparisonChartProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-gray-700" />
          <XAxis 
            dataKey="name" 
            stroke="#9ca3af"
            className="dark:stroke-gray-400"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#9ca3af"
            className="dark:stroke-gray-400"
            style={{ fontSize: '12px' }}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            }}
            wrapperClassName="dark:[&>div]:!bg-gray-800 dark:[&>div]:!border-gray-700"
          />
          <Legend 
            wrapperStyle={{ fontSize: '14px' }}
          />
          {bars.map((bar) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              name={bar.name}
              fill={bar.color}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
