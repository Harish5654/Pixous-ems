import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Settings, Plus, Trash2, Loader2, CalendarCheck, Users } from "lucide-react";
import toast from "react-hot-toast";
import { api, apiMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiEnvelope, LeaveType, HolidayResponse } from "@/types";
import { useAuth } from "@/hooks/useAuth";

export default function LeavePoliciesPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<"types" | "holidays">("types");
  const [createTypeOpen, setCreateTypeOpen] = useState(false);
  const [createHolidayOpen, setCreateHolidayOpen] = useState(false);
  const [allocYear, setAllocYear] = useState<number>(new Date().getFullYear());

  // Fetch Leave Types
  const leaveTypes = useQuery({
    queryKey: ["leave-types"],
    queryFn: async () => (await api.get<ApiEnvelope<LeaveType[]>>("/leave/types")).data.data
  });

  // Fetch Holidays
  const holidays = useQuery({
    queryKey: ["holidays"],
    queryFn: async () => (await api.get<ApiEnvelope<HolidayResponse[]>>("/org/holidays")).data.data
  });

  const deleteTypeMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/leave/types/${id}`);
    },
    onSuccess: () => {
      toast.success("Leave type deleted");
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
    },
    onError: (err) => toast.error(apiMessage(err, "Failed to delete leave type"))
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/org/holidays/${id}`);
    },
    onSuccess: () => {
      toast.success("Holiday deleted");
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
    },
    onError: (err) => toast.error(apiMessage(err, "Failed to delete holiday"))
  });

  const allocateMutation = useMutation({
    mutationFn: async (year: number) =>
      (await api.post<ApiEnvelope<{ created: number; employees: number; year: number }>>(
        `/leave/allocations/apply-defaults?year=${year}`
      )).data.data,
    onSuccess: (res) => {
      if (res.created > 0) {
        toast.success(`Allocated leave to ${res.employees} employees (${res.created} balances created) for ${res.year}`);
      } else {
        toast.success(`All ${res.employees} employees already have their ${res.year} leave allocated`);
      }
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
    },
    onError: (err) => toast.error(apiMessage(err, "Failed to allocate leave balances"))
  });

  const canManage = hasPermission("ORG_MANAGE");

  return (
    <div>
      <PageHeader 
        title="Leave Policies & Holidays" 
        subtitle="Manage organization leave types and holiday calendar." 
      />

      <div className="flex gap-2 mb-6 border-b pb-2">
        <button
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === "types" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
          onClick={() => setActiveTab("types")}
        >
          <Settings className="w-4 h-4 inline mr-2" /> Leave Types
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === "holidays" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
          onClick={() => setActiveTab("holidays")}
        >
          <Calendar className="w-4 h-4 inline mr-2" /> Holidays
        </button>
      </div>

      {activeTab === "types" && (
        <div className="space-y-4">
          {canManage && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <CalendarCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Allocate leave to all employees</h4>
                    <p className="text-xs text-muted-foreground max-w-md">
                      Gives every employee their annual balance using each type&apos;s max days
                      (e.g. Casual 12, Sick 12, Earned 18). Employees must have a balance before
                      they can apply. Safe to run again — existing balances are kept.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-col">
                    <Label htmlFor="allocYear" className="text-[10px] uppercase text-muted-foreground">Year</Label>
                    <Input
                      id="allocYear"
                      type="number"
                      value={allocYear}
                      onChange={(e) => setAllocYear(Number(e.target.value))}
                      className="h-9 w-24"
                    />
                  </div>
                  <Button
                    className="self-end bg-green-600 text-white hover:bg-green-700"
                    disabled={allocateMutation.isPending}
                    onClick={() => {
                      if (confirm(`Allocate default leave balances to all employees for ${allocYear}?`)) {
                        allocateMutation.mutate(allocYear);
                      }
                    }}
                  >
                    {allocateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Users className="h-4 w-4 mr-2" />}
                    Allocate to all
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-lg">Leave Types</h3>
            {canManage && (
              <Button size="sm" onClick={() => setCreateTypeOpen(true)}><Plus className="w-4 h-4 mr-2" /> Add Leave Type</Button>
            )}
          </div>
          
          {leaveTypes.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Code</th>
                      <th className="px-4 py-3 font-medium">Max Days/Year</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {leaveTypes.data?.map(t => (
                      <tr key={t.id} className="hover:bg-muted/50">
                        <td className="px-4 py-3 font-medium">{t.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{t.code}</td>
                        <td className="px-4 py-3 text-muted-foreground">{t.maxDaysPerYear || "Unlimited"}</td>
                        <td className="px-4 py-3 text-right">
                          {canManage && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive"
                              onClick={() => {
                                if(confirm("Are you sure?")) deleteTypeMutation.mutate(t.id)
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "holidays" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-lg">Holidays</h3>
            {canManage && (
              <Button size="sm" onClick={() => setCreateHolidayOpen(true)}><Plus className="w-4 h-4 mr-2" /> Add Holiday</Button>
            )}
          </div>
          
          {holidays.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Holiday Name</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {holidays.data?.map(h => (
                      <tr key={h.id} className="hover:bg-muted/50">
                        <td className="px-4 py-3 font-medium">{h.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{h.holidayDate}</td>
                        <td className="px-4 py-3 text-right">
                          {canManage && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive"
                              onClick={() => {
                                if(confirm("Are you sure?")) deleteHolidayMutation.mutate(h.id)
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      {createTypeOpen && <CreateLeaveTypeDialog onClose={() => setCreateTypeOpen(false)} />}
      {createHolidayOpen && <CreateHolidayDialog onClose={() => setCreateHolidayOpen(false)} />}
    </div>
  );
}

interface LeaveTypeForm {
  name: string;
  code: string;
  maxDaysPerYear?: number;
  carryForward: boolean;
  encashable: boolean;
}

function CreateLeaveTypeDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<LeaveTypeForm>({
    defaultValues: { carryForward: false, encashable: false }
  });

  const create = useMutation({
    mutationFn: async (v: LeaveTypeForm) => api.post("/leave/types", {
      ...v,
      maxDaysPerYear: v.maxDaysPerYear ? Number(v.maxDaysPerYear) : null
    }),
    onSuccess: () => {
      toast.success("Leave type created");
      qc.invalidateQueries({ queryKey: ["leave-types"] });
      onClose();
    },
    onError: (err) => toast.error(apiMessage(err, "Could not create leave type"))
  });

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader title="Add Leave Type" description="Create a new leave policy." />
      <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" placeholder="e.g. Annual Leave" {...register("name", { required: true })} />
          {errors.name && <p className="text-xs text-destructive">Name is required</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="code">Code</Label>
            <Input id="code" placeholder="e.g. AL" {...register("code", { required: true })} />
            {errors.code && <p className="text-xs text-destructive">Code is required</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxDaysPerYear">Max Days / Year</Label>
            <Input id="maxDaysPerYear" type="number" placeholder="Leave empty for unlimited" {...register("maxDaysPerYear")} />
          </div>
        </div>
        <div className="flex gap-4 pt-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="rounded border-input text-primary focus:ring-primary" {...register("carryForward")} />
            Carry forward unused
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="rounded border-input text-primary focus:ring-primary" {...register("encashable")} />
            Encashable
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

interface HolidayForm {
  name: string;
  holidayDate: string;
}

function CreateHolidayDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<HolidayForm>();

  const create = useMutation({
    mutationFn: async (v: HolidayForm) => api.post("/org/holidays", v),
    onSuccess: () => {
      toast.success("Holiday created");
      qc.invalidateQueries({ queryKey: ["holidays"] });
      onClose();
    },
    onError: (err) => toast.error(apiMessage(err, "Could not create holiday"))
  });

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader title="Add Holiday" description="Schedule a company-wide holiday." />
      <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Holiday Name</Label>
          <Input id="name" placeholder="e.g. New Year" {...register("name", { required: true })} />
          {errors.name && <p className="text-xs text-destructive">Name is required</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="holidayDate">Date</Label>
          <Input id="holidayDate" type="date" {...register("holidayDate", { required: true })} />
          {errors.holidayDate && <p className="text-xs text-destructive">Date is required</p>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
