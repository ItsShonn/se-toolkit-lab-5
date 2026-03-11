import { useState, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
)

// Types for API responses
interface ScoreBucket {
  bucket: string
  count: number
}

interface TimelineEntry {
  date: string
  submissions: number
}

interface PassRateEntry {
  task: string
  avg_score: number
  attempts: number
}

interface LabItem {
  id: number
  type: string
  title: string
  parent_id: number | null
}

type FetchState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string }

const API_BASE = '/analytics'

async function fetchWithAuth<T>(endpoint: string, lab: string): Promise<T> {
  const apiKey = localStorage.getItem('api_key')
  const response = await fetch(`${API_BASE}${endpoint}?lab=${encodeURIComponent(lab)}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`)
  }
  return response.json()
}

function extractLabId(title: string): string | null {
  // Extract lab number from title like "Lab 04 — Testing" -> "lab-04"
  const match = title.match(/Lab\s*(\d+)/i)
  if (match) {
    const num = match[1].padStart(2, '0')
    return `lab-${num}`
  }
  return null
}

function Dashboard() {
  const [labs, setLabs] = useState<LabItem[]>([])
  const [selectedLab, setSelectedLab] = useState<string>('')
  const [scoresState, setScoresState] = useState<FetchState<ScoreBucket[]>>({ status: 'idle' })
  const [timelineState, setTimelineState] = useState<FetchState<TimelineEntry[]>>({ status: 'idle' })
  const [passRatesState, setPassRatesState] = useState<FetchState<PassRateEntry[]>>({ status: 'idle' })

  // Fetch labs list on mount
  useEffect(() => {
    const fetchLabs = async () => {
      const apiKey = localStorage.getItem('api_key')
      try {
        const response = await fetch('/items/', {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const items: LabItem[] = await response.json()
        const labItems = items.filter((item) => item.type === 'lab')
        setLabs(labItems)
        if (labItems.length > 0) {
          // Extract lab ID from title (e.g., "Lab 04 — Testing" -> "lab-04")
          const firstLabId = extractLabId(labItems[0].title)
          if (firstLabId) {
            setSelectedLab(firstLabId)
          }
        }
      } catch (err) {
        console.error('Failed to fetch labs:', err)
      }
    }
    fetchLabs()
  }, [])

  // Fetch analytics data when selected lab changes
  useEffect(() => {
    if (!selectedLab) return

    const fetchData = async () => {
      // Fetch scores
      setScoresState({ status: 'loading' })
      try {
        const data = await fetchWithAuth<ScoreBucket[]>('/scores', selectedLab)
        setScoresState({ status: 'success', data })
      } catch (err) {
        setScoresState({ status: 'error', message: (err as Error).message })
      }

      // Fetch timeline
      setTimelineState({ status: 'loading' })
      try {
        const data = await fetchWithAuth<TimelineEntry[]>('/timeline', selectedLab)
        setTimelineState({ status: 'success', data })
      } catch (err) {
        setTimelineState({ status: 'error', message: (err as Error).message })
      }

      // Fetch pass rates
      setPassRatesState({ status: 'loading' })
      try {
        const data = await fetchWithAuth<PassRateEntry[]>('/pass-rates', selectedLab)
        setPassRatesState({ status: 'success', data })
      } catch (err) {
        setPassRatesState({ status: 'error', message: (err as Error).message })
      }
    }

    fetchData()
  }, [selectedLab])

  function handleLabChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedLab(e.target.value)
  }

  // Prepare score distribution chart data
  const scoreChartData = {
    labels: scoresState.status === 'success' ? scoresState.data.map((b) => b.bucket) : [],
    datasets: [
      {
        label: 'Number of Students',
        data: scoresState.status === 'success' ? scoresState.data.map((b) => b.count) : [],
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  }

  // Prepare timeline chart data
  const timelineChartData = {
    labels: timelineState.status === 'success' ? timelineState.data.map((t) => t.date) : [],
    datasets: [
      {
        label: 'Submissions',
        data: timelineState.status === 'success' ? timelineState.data.map((t) => t.submissions) : [],
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.3,
        fill: true,
      },
    ],
  }

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  }

  const lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <div className="lab-selector">
          <label htmlFor="lab-select">Select Lab: </label>
          <select
            id="lab-select"
            value={selectedLab}
            onChange={handleLabChange}
            disabled={labs.length === 0}
          >
            {labs.length === 0 && <option value="">Loading labs...</option>}
            {labs.map((lab) => {
              const labId = extractLabId(lab.title)
              if (!labId) return null
              return (
                <option key={lab.id} value={labId}>
                  {lab.title}
                </option>
              )
            })}
          </select>
        </div>
      </header>

      <div className="dashboard-content">
        {/* Score Distribution Chart */}
        <section className="chart-section">
          <h2>Score Distribution</h2>
          {scoresState.status === 'idle' && <p>Select a lab to view data</p>}
          {scoresState.status === 'loading' && <p>Loading...</p>}
          {scoresState.status === 'error' && <p className="error">Error: {scoresState.message}</p>}
          {scoresState.status === 'success' && scoresState.data.length === 0 && (
            <p>No data available</p>
          )}
          {scoresState.status === 'success' && scoresState.data.length > 0 && (
            <div style={{ height: '300px' }}>
              <Bar data={scoreChartData} options={chartOptions} />
            </div>
          )}
        </section>

        {/* Timeline Chart */}
        <section className="chart-section">
          <h2>Submissions Timeline</h2>
          {timelineState.status === 'idle' && <p>Select a lab to view data</p>}
          {timelineState.status === 'loading' && <p>Loading...</p>}
          {timelineState.status === 'error' && <p className="error">Error: {timelineState.message}</p>}
          {timelineState.status === 'success' && timelineState.data.length === 0 && (
            <p>No data available</p>
          )}
          {timelineState.status === 'success' && timelineState.data.length > 0 && (
            <div style={{ height: '300px' }}>
              <Line data={timelineChartData} options={lineChartOptions} />
            </div>
          )}
        </section>

        {/* Pass Rates Table */}
        <section className="table-section">
          <h2>Pass Rates by Task</h2>
          {passRatesState.status === 'idle' && <p>Select a lab to view data</p>}
          {passRatesState.status === 'loading' && <p>Loading...</p>}
          {passRatesState.status === 'error' && <p className="error">Error: {passRatesState.message}</p>}
          {passRatesState.status === 'success' && passRatesState.data.length === 0 && (
            <p>No data available</p>
          )}
          {passRatesState.status === 'success' && passRatesState.data.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Average Score</th>
                  <th>Attempts</th>
                </tr>
              </thead>
              <tbody>
                {passRatesState.data.map((entry, index) => (
                  <tr key={index}>
                    <td>{entry.task}</td>
                    <td>{entry.avg_score.toFixed(1)}</td>
                    <td>{entry.attempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  )
}

export default Dashboard
