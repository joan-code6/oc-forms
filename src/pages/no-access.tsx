import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShieldX } from "lucide-react"

export function NoAccessPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <ShieldX className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <h1 className="mb-2 text-xl font-semibold text-white">
            Access Denied
          </h1>
          <p className="mb-6 text-sm text-white/50">
            You do not have the required Discord staff role to access the
            moderator panel.
          </p>
          <Button variant="outline" onClick={() => navigate("/")}>
            Return Home
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
