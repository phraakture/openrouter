import { DashboardLayout } from "@/components/DashboardLayout";
import { useElysiaClient } from "@/providers/Eden";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, Loader2, CheckCircle2, AlertCircle, Plus } from "lucide-react";

export function Credits() {
  const elysiaClient = useElysiaClient();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const response = await elysiaClient.auth.profile.get();
      if (response.error) throw new Error("Failed to fetch profile");
      return response.data;
    },
  });

  const onrampMutation = useMutation({
    mutationFn: async () => {
      const response = await elysiaClient.payments.onramp.post();
      if (response.error) {
        const errValue = response.error.value as { message?: string } | undefined;
        throw new Error(errValue?.message || "Onramp failed");
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const credits = profileQuery.data?.credits ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Credits</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your account balance and top up credits.
          </p>
        </div>

        {/* Balance card */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current balance</span>
              <Coins className="size-4 text-muted-foreground/60" />
            </div>
          </CardHeader>
          <CardContent>
            {profileQuery.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                <Loader2 className="size-4 animate-spin" />
                Loading balance...
              </div>
            ) : (
              <>
                <p className="text-4xl font-bold tracking-tight">
                  {credits.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">credits available</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Top up */}
        <Card className="bg-card/30 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Top up credits</CardTitle>
            <CardDescription>
              Add credits to your account instantly. Each top up adds 1,000 credits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => onrampMutation.mutate()}
              disabled={onrampMutation.isPending || onrampMutation.isSuccess}
              className="h-10"
            >
              {onrampMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Processing...
                </>
              ) : onrampMutation.isSuccess ? (
                <>
                  <CheckCircle2 className="size-4" />
                  Credited
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  Add 1,000 credits
                </>
              )}
            </Button>

            {onrampMutation.isSuccess && (
              <div className="flex items-start gap-2.5 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3.5 py-3">
                <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                <span>
                  Successfully added credits. Your new balance is{" "}
                  {onrampMutation.data?.credits.toLocaleString() ?? credits.toLocaleString()}.
                </span>
              </div>
            )}

            {onrampMutation.isError && (
              <div className="flex items-start gap-2.5 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3.5 py-3">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{onrampMutation.error?.message || "Onramp failed. Please try again."}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
