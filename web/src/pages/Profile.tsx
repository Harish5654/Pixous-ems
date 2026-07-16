import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, Save, Plus, Trash2, Landmark, BadgeCheck, Camera
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { api, apiMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiEnvelope, Profile, BankResponse } from "@/types";

interface ProfileForm {
  name?: string;
  email?: string;
  gender?: string;
  house?: string;
  street?: string;
  locality?: string;
  district?: string;
  state?: string;
  pincode?: string;
}

export default function ProfilePage() {
  const qc = useQueryClient();
  const { refreshUser } = useAuth();
  const [bankOpen, setBankOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await api.get<ApiEnvelope<Profile>>("/users/me")).data.data
  });

  const uploadPhoto = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return api.post<ApiEnvelope<{ photoPath: string }>>("/users/me/photo", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
    },
    onSuccess: async () => {
      toast.success("Photo updated");
      await qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      // Update the sidebar / topbar avatar too.
      await refreshUser();
    },
    onError: (err) => toast.error(apiMessage(err, "Could not upload photo"))
  });

  function onPhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    uploadPhoto.mutate(file);
    e.target.value = ""; // allow re-selecting the same file
  }

  const banks = useQuery({
    queryKey: ["banks"],
    queryFn: async () => (await api.get<ApiEnvelope<BankResponse[]>>("/users/me/bank")).data.data
  });

  const { register, handleSubmit, reset } = useForm<ProfileForm>();

  useEffect(() => {
    if (profile.data) {
      reset({
        name: profile.data.name,
        email: profile.data.email,
        gender: profile.data.gender,
        house: profile.data.address?.house,
        street: profile.data.address?.street,
        locality: profile.data.address?.locality,
        district: profile.data.address?.district,
        state: profile.data.address?.state,
        pincode: profile.data.address?.pincode
      });
    }
  }, [profile.data, reset]);

  const save = useMutation({
    mutationFn: async (v: ProfileForm) => api.put("/users/me", v),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (err) => toast.error(apiMessage(err, "Could not update profile"))
  });

  const removeBank = useMutation({
    mutationFn: async (id: number) => api.delete(`/users/me/bank/${id}`),
    onSuccess: () => {
      toast.success("Bank account removed");
      qc.invalidateQueries({ queryKey: ["banks"] });
    },
    onError: (err) => toast.error(apiMessage(err, "Could not remove account"))
  });

  const p = profile.data;

  return (
    <div>
      <PageHeader title="My profile" subtitle="Your details and bank accounts for payroll." />

      {profile.isLoading || !p ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Identity card */}
          <Card className="lg:col-span-1">
            <CardContent className="flex flex-col items-center p-6 text-center">
              <div className="group relative">
                <Avatar name={p.name} src={p.photoPath} className="h-20 w-20 text-2xl" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPhotoPicked}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadPhoto.isPending}
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105 disabled:opacity-60"
                  aria-label="Change photo"
                  title="Add / change photo"
                >
                  {uploadPhoto.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadPhoto.isPending}
                className="mt-2 text-xs font-medium text-primary hover:underline disabled:opacity-60"
              >
                {p.photoPath ? "Change photo" : "Add photo"}
              </button>
              <h2 className="mt-3 font-display text-lg font-bold">{p.name}</h2>
              <div className="code-chip text-sm text-muted-foreground">{p.employeeCode}</div>
              <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                <BadgeCheck className="h-4 w-4 text-success" />
                {p.profileStatus || "Active"}
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {p.roles?.map((r) => (
                  <Badge key={r} className="code-chip">
                    {r}
                  </Badge>
                ))}
              </div>
              <dl className="mt-6 w-full space-y-2 text-left text-sm">
                <Row label="Industry" value={p.industry === "IT" ? "DIGITAL" : p.industry === "CIVIL" ? "INFRA" : p.industry} />
                <Row label="Employment" value={p.employmentType} />
                <Row
                  label="Joined"
                  value={p.dateOfJoining ? dayjs(p.dateOfJoining).format("DD MMM YYYY") : undefined}
                />
                <Row label="Aadhaar" value={p.aadhar ? `•••• •••• ${p.aadhar.slice(-4)}` : undefined} />
              </dl>
            </CardContent>
          </Card>

          {/* Editable form */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Personal details</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Full name</Label>
                      <Input id="name" {...register("name")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" {...register("email")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="gender">Gender</Label>
                      <Input id="gender" {...register("gender")} />
                    </div>
                  </div>

                  <div className="pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Address
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="house">House / building</Label>
                      <Input id="house" {...register("house")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="street">Street</Label>
                      <Input id="street" {...register("street")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="locality">Locality</Label>
                      <Input id="locality" {...register("locality")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="district">District</Label>
                      <Input id="district" {...register("district")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="state">State</Label>
                      <Input id="state" {...register("state")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pincode">Pincode</Label>
                      <Input id="pincode" className="code-chip" {...register("pincode")} />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={save.isPending}>
                      {save.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save changes
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Bank accounts */}
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Bank accounts</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setBankOpen(true)}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </CardHeader>
              <CardContent>
                {banks.isLoading ? (
                  <Skeleton className="h-24" />
                ) : (banks.data?.length ?? 0) === 0 ? (
                  <EmptyState
                    icon={Landmark}
                    title="No bank accounts"
                    description="Add an account so payroll can be credited correctly."
                  />
                ) : (
                  <div className="space-y-3">
                    {banks.data!.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center gap-3 rounded-lg border p-3"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Landmark className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{b.bankName}</span>
                            {b.primary && <Badge variant="success">Primary</Badge>}
                          </div>
                          <div className="code-chip text-xs text-muted-foreground">
                            ••••{b.accountNumber.slice(-4)} · {b.ifscCode}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={removeBank.isPending}
                          onClick={() => removeBank.mutate(b.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {bankOpen && <AddBankDialog onClose={() => setBankOpen(false)} />}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}

interface BankForm {
  bankName: string;
  branchName?: string;
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;
  primary?: boolean;
}

function AddBankDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<BankForm>();

  const add = useMutation({
    mutationFn: async (v: BankForm) => api.post("/users/me/bank", v),
    onSuccess: () => {
      toast.success("Bank account added");
      qc.invalidateQueries({ queryKey: ["banks"] });
      onClose();
    },
    onError: (err) => toast.error(apiMessage(err, "Could not add account"))
  });

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader title="Add bank account" description="Used for salary credit." />
      <form onSubmit={handleSubmit((v) => add.mutate(v))} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="accountHolderName">Account holder name</Label>
          <Input id="accountHolderName" {...register("accountHolderName", { required: true })} />
          {errors.accountHolderName && (
            <p className="text-xs text-destructive">Required</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="bankName">Bank</Label>
            <Input id="bankName" {...register("bankName", { required: true })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="branchName">Branch</Label>
            <Input id="branchName" {...register("branchName")} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="accountNumber">Account number</Label>
            <Input
              id="accountNumber"
              className="code-chip"
              {...register("accountNumber", { 
                required: "Required",
                pattern: { value: /^\d{6,20}$/, message: "Must be 6-20 digits" }
              })}
            />
            {errors.accountNumber && (
              <p className="text-xs text-destructive">{errors.accountNumber.message as string}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ifscCode">IFSC</Label>
            <Input
              id="ifscCode"
              className="code-chip uppercase"
              {...register("ifscCode", { 
                required: "Required",
                pattern: { value: /^[A-Z]{4}0[A-Z0-9]{6}$/i, message: "Invalid IFSC format" }
              })}
            />
            {errors.ifscCode && (
              <p className="text-xs text-destructive">{errors.ifscCode.message as string}</p>
            )}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" {...register("primary")} />
          Set as primary account
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={add.isPending}>
            {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Add account
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
