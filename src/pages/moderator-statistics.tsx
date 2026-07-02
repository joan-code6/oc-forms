import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useModeratorAccess } from "@/hooks/use-moderator-access"
import { callFunction } from "@/lib/functions"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  AlertTriangle,
  RefreshCw,
  FileText,
  CheckCircle2,
  Clock,
  TrendingUp,
  Star,
  UserCheck,
  Target,
  XCircle,
  Users,
  UserRoundCheck,
  Percent,
  Repeat,
  Hash,
} from "lucide-react"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

const STATS_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_FUNCTION_DASHBOARD_STATS_ID || "get-dashboard-stats"

interface OverviewStats {
  totalApplications: number
  openApplications: number
  inReview: number
  reviewedApplications: number
  closedApplications: number
  averageRating: number
  totalReviews: number
  uniqueModerators: number
  acceptanceRate: number
  totalUsers: number
  uniqueApplicants: number
  conversionRate: number
  repeatApplicants: number
  avgAppsPerUser: number
}

interface StatusDistribution {
  pending: number
  pending_2nd: number
  in_review: number
  reviewed: number
  closed: number
}

interface TimeSeriesEntry {
  date: string
  count: number
}

interface RatingBucket {
  bucket: string
  count: number
}

interface ModeratorStats {
  username: string
  count: number
  averageRating: number
}

interface TimezoneEntry {
  timezone: string
  count: number
}

interface ZoneEntry {
  zone: string
  count: number
}


interface DashboardStats {
  overview: OverviewStats
  statusDistribution: StatusDistribution
  applicationsOverTime: TimeSeriesEntry[]
  ratingDistribution: RatingBucket[]
  reviewsPerModerator: ModeratorStats[]
  timezoneDistribution: TimezoneEntry[]
  ratingZoneDistribution: ZoneEntry[]
  reviewsOverTime: TimeSeriesEntry[]
}

const CHART_COLORS = ["#b57bee", "#4ade80", "#f97316", "#eab308", "#ef4444"]
const ZONE_COLORS: Record<string, string> = {
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
}
const STATUS_COLORS: Record<string, string> = {
  pending: "#eab308",
  pending_2nd: "#f97316",
  in_review: "#3b82f6",
  reviewed: "#22c55e",
  closed: "#6b7280",
}

function StatCard({
  label,
  value,
  icon: Icon,
  suffix,
}: {
  label: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  suffix?: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-white/40">
            {label}
          </p>
          <Icon className="h-4 w-4 text-brand" />
        </div>
        <p className="mt-2 text-2xl font-bold text-white">
          {value}
          {suffix && (
            <span className="ml-1 text-sm font-normal text-white/40">
              {suffix}
            </span>
          )}
        </p>
      </CardContent>
    </Card>
  )
}

function ChartCard({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardContent className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-white/60">{title}</h3>
        {children}
      </CardContent>
    </Card>
  )
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ color?: string; name?: string; value?: number | string }>
  label?: string
}) {
  if (!active || !payload || !Array.isArray(payload) || payload.length === 0)
    return null

  return (
    <div className="rounded-lg border border-white/10 bg-black/80 px-3 py-2 shadow-xl backdrop-blur-sm">
      {label && (
        <p className="mb-1 text-xs font-medium text-white/50">{String(label)}</p>
      )}
      {payload.map((entry: Record<string, unknown>, index: number) => (
        <p key={index} className="text-sm font-semibold text-white">
          <span
            className="mr-1.5 inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: String(entry.color) }}
          />
          {String(entry.name)}: {String(entry.value)}
        </p>
      ))}
    </div>
  )
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function ModeratorStatisticsPage() {
  const { allowed, loading: accessLoading } = useModeratorAccess()
  const navigate = useNavigate()

  const {
    data: stats,
    isLoading: loading,
    error,
    refetch,
  } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => callFunction<DashboardStats>(STATS_FUNCTION_ID),
    enabled: allowed,
    staleTime: 60_000,
  })

  const statsError = error instanceof Error ? error.message : null

  const fetchStats = useCallback(() => {
    refetch()
  }, [refetch])

  if (accessLoading || !allowed) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-12">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/moderator")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-white">Statistics</h1>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {statsError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {statsError}
        </div>
      )}

      {loading && !stats ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 13 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-lg" />
            ))}
          </div>
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Total Apps"
              value={stats.overview.totalApplications}
              icon={FileText}
            />
            <StatCard
              label="Open"
              value={stats.overview.openApplications}
              icon={Clock}
            />
            <StatCard
              label="In Review"
              value={stats.overview.inReview}
              icon={Target}
            />
            <StatCard
              label="Reviewed"
              value={stats.overview.reviewedApplications}
              icon={CheckCircle2}
            />
            <StatCard
              label="Closed"
              value={stats.overview.closedApplications}
              icon={XCircle}
            />
            <StatCard
              label="Avg Rating"
              value={stats.overview.averageRating}
              icon={Star}
              suffix="%"
            />
            <StatCard
              label="Accept Rate"
              value={stats.overview.acceptanceRate}
              icon={TrendingUp}
              suffix="%"
            />
            <StatCard
              label="Moderators"
              value={stats.overview.uniqueModerators}
              icon={UserCheck}
            />
            <StatCard
              label="Auth Users"
              value={stats.overview.totalUsers}
              icon={Users}
            />
            <StatCard
              label="Applicants"
              value={stats.overview.uniqueApplicants}
              icon={UserRoundCheck}
            />
            <StatCard
              label="Conversion"
              value={stats.overview.conversionRate}
              icon={Percent}
              suffix="%"
            />
            <StatCard
              label="Repeat Apps"
              value={stats.overview.repeatApplicants}
              icon={Repeat}
            />
            <StatCard
              label="Avg Apps/User"
              value={stats.overview.avgAppsPerUser}
              icon={Hash}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title="Status Distribution">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={Object.entries(stats.statusDistribution)
                      .filter(([, v]) => v > 0)
                      .map(([k, v]) => ({
                        name: k.replace("_", " "),
                        value: v,
                      }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {Object.entries(stats.statusDistribution)
                      .filter(([, v]) => v > 0)
                      .map(([k]) => (
                        <Cell
                          key={k}
                          fill={STATUS_COLORS[k] || CHART_COLORS[0]}
                          stroke="transparent"
                        />
                      ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    formatter={(value: string) => (
                      <span className="text-sm text-white/50">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Rating Zones">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={stats.ratingZoneDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="zone"
                  >
                    {stats.ratingZoneDistribution.map((entry) => (
                      <Cell
                        key={entry.zone}
                        fill={ZONE_COLORS[entry.zone] || CHART_COLORS[0]}
                        stroke="transparent"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    formatter={(value: string) => (
                      <span className="text-sm text-white/50 capitalize">
                        {value}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Applications Over Time" className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={stats.applicationsOverTime}>
                  <defs>
                    <linearGradient id="appGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#b57bee" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#b57bee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fontSize: 11, fill: "rgba(255,255,255,0.6)" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fontSize: 11, fill: "rgba(255,255,255,0.6)" }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    labelFormatter={(label) =>
                      typeof label === "string" ? formatDate(label) : label
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#b57bee"
                    fill="url(#appGradient)"
                    strokeWidth={2}
                    name="Submissions"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Rating Distribution">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.ratingDistribution}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                  />
                  <XAxis
                    dataKey="bucket"
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fontSize: 10, fill: "rgba(255,255,255,0.6)" }}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fontSize: 11, fill: "rgba(255,255,255,0.6)" }}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar
                    dataKey="count"
                    name="Reviews"
                    radius={[4, 4, 0, 0]}
                    fill="#4ade80"
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Reviews Over Time">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={stats.reviewsOverTime}>
                  <defs>
                    <linearGradient id="reviewGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fontSize: 11, fill: "rgba(255,255,255,0.6)" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fontSize: 11, fill: "rgba(255,255,255,0.6)" }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    labelFormatter={(label) =>
                      typeof label === "string" ? formatDate(label) : label
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#4ade80"
                    fill="url(#reviewGradient)"
                    strokeWidth={2}
                    name="Reviews"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Reviews per Moderator" className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  data={stats.reviewsPerModerator.slice(0, 15)}
                  layout="vertical"
                  margin={{ left: 20, right: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fontSize: 11, fill: "rgba(255,255,255,0.6)" }}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="username"
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fontSize: 11, fill: "rgba(255,255,255,0.6)" }}
                    width={120}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar
                    dataKey="count"
                    name="Reviews"
                    radius={[0, 4, 4, 0]}
                    fill="#b57bee"
                    maxBarSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Timezone Distribution" className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.timezoneDistribution.slice(0, 20)}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                  />
                  <XAxis
                    dataKey="timezone"
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fontSize: 9, fill: "rgba(255,255,255,0.6)" }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fontSize: 11, fill: "rgba(255,255,255,0.6)" }}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar
                    dataKey="count"
                    name="Applications"
                    radius={[4, 4, 0, 0]}
                    fill="#f97316"
                    maxBarSize={36}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Application Funnel">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  layout="vertical"
                  data={[
                    {
                      stage: "Auth Users",
                      count: stats.overview.totalUsers,
                      fill: "#b57bee",
                    },
                    {
                      stage: "Applied",
                      count: stats.overview.uniqueApplicants,
                      fill: "#3b82f6",
                    },
                    {
                      stage: "Reviewed",
                      count: stats.overview.reviewedApplications,
                      fill: "#22c55e",
                    },
                    {
                      stage: "Accepted",
                      count: Math.round(
                        (stats.overview.acceptanceRate / 100) *
                          stats.overview.reviewedApplications,
                      ),
                      fill: "#4ade80",
                    },
                  ]}
                  margin={{ left: 20, right: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fontSize: 11, fill: "rgba(255,255,255,0.6)" }}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="stage"
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fontSize: 12, fill: "rgba(255,255,255,0.6)" }}
                    width={80}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar
                    dataKey="count"
                    name="Count"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={32}
                  >
                    {[0, 1, 2, 3].map((i) => (
                      <Cell
                        key={i}
                        fill={["#b57bee", "#3b82f6", "#22c55e", "#4ade80"][i]}
                        stroke="transparent"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="User Engagement">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={[
                      {
                        name: "Applied",
                        value: stats.overview.uniqueApplicants,
                      },
                      {
                        name: "Not Applied",
                        value:
                          stats.overview.totalUsers -
                          stats.overview.uniqueApplicants,
                      },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    <Cell fill="#b57bee" stroke="transparent" />
                    <Cell fill="rgba(255,255,255,0.08)" stroke="transparent" />
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    formatter={(value: string) => (
                      <span className="text-sm text-white/50">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      ) : null}
    </div>
  )
}
