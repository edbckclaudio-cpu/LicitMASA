'use client';

import { useEffect, useState } from "react";
import { Bell, Plus, Trash2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/lib/supabaseClient";

type SearchAlert = { id: string; keyword: string; uf?: string };

export function AlertsManager() {
  const [alerts, setAlerts] = useState<SearchAlert[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  async function loadAlerts() {
    setError(null);
    if (!supabase) {
      setError("Configure o Supabase no .env");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      setLoggedIn(false);
      setAlerts([]);
      return;
    }
    setLoggedIn(true);
    setUserId(user.id);
    const { data: prof } = await supabase
      .from("profiles")
      .select("is_premium")
      .eq("id", user.id)
      .single();
    setIsPremium(Boolean(prof?.is_premium));
    const { data } = await supabase
      .from("search_alerts")
      .select("id, keyword, uf")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("created_at", { ascending: false });
    setAlerts((data || []).map((a: any) => ({ id: String(a.id), keyword: String(a.keyword || ""), uf: a.uf || undefined })));
  }

  useEffect(() => {
    const t = setTimeout(() => {
      loadAlerts();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const handleAddAlert = async () => {
    if (!newKeyword.trim()) return;
    if (!supabase) {
      setError("Configure o Supabase no .env");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      setError("Entre para criar alertas");
      return;
    }
    if (!isPremium && alerts.length >= 3) {
      setError("Limite de 3 alertas no plano gratuito");
      return;
    }
    setIsLoading(true);
    const { data, error } = await supabase
      .from("search_alerts")
      .insert({
        user_id: user.id,
        keyword: newKeyword.trim(),
        active: true,
      })
      .select("id, keyword, uf")
      .single();
    if (error) {
      setError("Falha ao criar alerta");
      setIsLoading(false);
      return;
    }
    setAlerts([{ id: String(data.id), keyword: String(data.keyword || ""), uf: data.uf || undefined }, ...alerts]);
    setNewKeyword("");
    setIsLoading(false);
  };

  const handleDeleteAlert = async (id: string) => {
    if (!supabase || !userId) {
      setAlerts(alerts.filter((a) => a.id !== id));
      return;
    }
    try {
      await supabase
        .from("search_alerts")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      setAlerts(alerts.filter((a) => a.id !== id));
    } catch {
      setAlerts(alerts.filter((a) => a.id !== id));
    }
  };

  return (
    <Card className="w-full max-w-2xl shadow-sm border-blue-100">
      <CardHeader className="bg-slate-50/50 pb-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-lg">Meus Alertas Automáticos</CardTitle>
        </div>
        <CardDescription>Receba avisos de novas licitações por palavra-chave.</CardDescription>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {!loggedIn && (
          <Alert className="bg-blue-50 border-blue-100">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">Entre para criar alertas</AlertTitle>
            <AlertDescription className="text-blue-700">Faça login para ativar alertas automáticos.</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert className="bg-red-50 border-red-100">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Erro</AlertTitle>
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex gap-2 items-end">
          <div className="grid w-full gap-1.5">
            <label className="text-xs font-medium text-slate-500 uppercase">Palavra-chave</label>
            <Input
              placeholder="Ex: Limpeza, TI..."
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddAlert()}
            />
          </div>
          <Button onClick={handleAddAlert} disabled={isLoading || !newKeyword.trim() || !loggedIn} className="bg-blue-600">
            {isLoading ? "..." : <><Plus className="mr-1 h-4 w-4" /> Criar</>}
          </Button>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase">Alertas Ativos ({alerts.length})</h3>
          
          {alerts.length === 0 && (
            <Alert className="bg-blue-50 border-blue-100">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">Sem alertas</AlertTitle>
              <AlertDescription className="text-blue-700">Adicione termos para monitorar.</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-3 bg-white rounded-md border border-slate-200 hover:border-blue-200 transition-all shadow-sm">
                <div className="flex items-center gap-2">
                  <Badge className="bg-slate-100">{alert.keyword}</Badge>
                  {alert.uf && <Badge className="text-[10px]">{alert.uf}</Badge>}
                </div>
                <Button onClick={() => handleDeleteAlert(alert.id)} className="text-slate-400 hover:text-red-600 bg-transparent">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-slate-50/50 py-2 justify-center">
         <p className="text-[10px] text-slate-400">Plano Premium: Alertas ilimitados ativos.</p>
      </CardFooter>
    </Card>
  );
}
