import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QRCode from "react-qr-code";
import {
  Plus, Loader2, Boxes, QrCode, CheckCircle2, PackageCheck
} from "lucide-react";
import toast from "react-hot-toast";
import { api, apiMessage } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import type { ApiEnvelope, PageEnvelope, Asset } from "@/types";

export default function AssetsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("ASSET_MANAGE");
  const [qrAsset, setQrAsset] = useState<Asset | null>(null);
  const [allocateAsset, setAllocateAsset] = useState<Asset | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);

  const mine = useQuery({
    queryKey: ["assets", "mine"],
    queryFn: async () =>
      (await api.get<ApiEnvelope<Asset[]>>("/assets/my-assets")).data.data
  });

  const inventory = useQuery({
    queryKey: ["assets", "inventory"],
    enabled: canManage,
    queryFn: async () => {
      const res = await api.get<PageEnvelope<Asset>>("/assets?size=50");
      return res.data?.content || [];
    }
  });

  const acknowledge = useMutation({
    mutationFn: async (id: number) => api.post(`/assets/${id}/acknowledge`),
    onSuccess: () => {
      toast.success("Receipt acknowledged");
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (err) => toast.error(apiMessage(err, "Could not acknowledge"))
  });

  return (
    <div>
      <PageHeader
        title="Assets"
        subtitle="Equipment assigned to you, with QR tags. Managers can register and allocate."
        actions={
          canManage ? (
            <Button onClick={() => setRegisterOpen(true)}>
              <Plus className="h-4 w-4" /> Register asset
            </Button>
          ) : null
        }
      />

      {/* My assets */}
      <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Assigned to me
      </h2>
      {mine.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (mine.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No assets assigned"
          description="Equipment allocated to you will appear here with its QR tag."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mine.data!.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-display font-semibold">
                      {a.assetType || a.category}
                    </div>
                    <div className="code-chip text-xs text-muted-foreground">{a.assetCode}</div>
                  </div>
                  <Badge variant={statusVariant(a.status)}>{a.status}</Badge>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {[a.brand, a.model].filter(Boolean).join(" ") || "—"}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setQrAsset(a)}>
                    <QrCode className="h-4 w-4" /> QR
                  </Button>
                  <Button
                    size="sm"
                    disabled={acknowledge.isPending}
                    onClick={() => acknowledge.mutate(a.id)}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Acknowledge
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Inventory (managers) */}
      {canManage && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            {inventory.isLoading ? (
              <Skeleton className="h-52" />
            ) : (inventory.data?.length ?? 0) === 0 ? (
              <EmptyState title="No assets registered" description="Register your first asset to begin." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory.data!.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="code-chip">{a.assetCode}</TableCell>
                      <TableCell>{a.assetType || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{a.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(a.status)}>{a.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setQrAsset(a)}>
                            <QrCode className="h-4 w-4" />
                          </Button>
                          {a.status === "IN_STOCK" && (
                            <Button variant="ghost" size="sm" onClick={() => setAllocateAsset(a)}>
                              <PackageCheck className="h-4 w-4" /> Allocate
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* QR dialog */}
      <Dialog open={qrAsset != null} onClose={() => setQrAsset(null)} className="max-w-sm">
        {qrAsset && (
          <div className="text-center">
            <DialogHeader title={qrAsset.assetType || qrAsset.category} />
            <div className="mx-auto w-fit rounded-lg bg-white p-4">
              <QRCode value={`ASSET:${qrAsset.assetCode}`} size={180} />
            </div>
            <div className="code-chip mt-3 text-sm text-muted-foreground">{qrAsset.assetCode}</div>
            <p className="mt-2 text-xs text-muted-foreground">
              Scan to look up this asset's details and service history.
            </p>
          </div>
        )}
      </Dialog>

      {allocateAsset && (
        <AllocateDialog asset={allocateAsset} onClose={() => setAllocateAsset(null)} />
      )}
      {registerOpen && <RegisterDialog onClose={() => setRegisterOpen(false)} />}
    </div>
  );
}

function AllocateDialog({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");

  const allocate = useMutation({
    mutationFn: async () =>
      api.post(`/assets/${asset.id}/allocate`, { userId: Number(userId) }),
    onSuccess: () => {
      toast.success("Asset allocated");
      qc.invalidateQueries({ queryKey: ["assets"] });
      onClose();
    },
    onError: (err) => toast.error(apiMessage(err, "Could not allocate"))
  });

  return (
    <Dialog open onClose={onClose} className="max-w-sm">
      <DialogHeader
        title={`Allocate ${asset.assetCode}`}
        description="Assign this asset to an employee by their user ID."
      />
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="userId">Employee user ID</Label>
          <Input
            id="userId"
            inputMode="numeric"
            placeholder="e.g. 1"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Find IDs in the Employees directory.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!userId || allocate.isPending} onClick={() => allocate.mutate()}>
            {allocate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Allocate
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

interface RegisterForm {
  category: string;
  assetType: string;
  brand: string;
  model: string;
  serialNumber: string;
}

function RegisterDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit } = useForm<RegisterForm>({
    defaultValues: { category: "IT" }
  });

  const create = useMutation({
    mutationFn: async (v: RegisterForm) => api.post("/assets", v),
    onSuccess: () => {
      toast.success("Asset registered");
      qc.invalidateQueries({ queryKey: ["assets"] });
      onClose();
    },
    onError: (err) => toast.error(apiMessage(err, "Could not register asset"))
  });

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader
        title="Register asset"
        description="A unique asset code and QR tag are generated automatically."
      />
      <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Select id="category" {...register("category")}>
              <option value="IT">IT</option>
              <option value="INFRA">Infrastructure</option>
              <option value="MACHINERY">Machinery</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assetType">Type</Label>
            <Input id="assetType" placeholder="Laptop, Excavator…" {...register("assetType")} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="brand">Brand</Label>
            <Input id="brand" {...register("brand")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="model">Model</Label>
            <Input id="model" {...register("model")} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="serialNumber">Serial number</Label>
          <Input id="serialNumber" className="code-chip" {...register("serialNumber")} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Register
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
