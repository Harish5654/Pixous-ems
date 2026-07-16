import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Map, Plus, Check, X, Settings, Upload, Loader2, ImagePlus } from "lucide-react";
import toast from "react-hot-toast";
import { api, apiMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { resolvePhotoUrl } from "@/components/ui/avatar";
import { Eye } from "lucide-react";
import dayjs from "dayjs";

export default function TaExpensesPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  // Only org admins configure rates and see everyone's expenses.
  // Employees and managers see only their own entries.
  const canManage = hasPermission("ORG_MANAGE");
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [viewRow, setViewRow] = useState<any | null>(null);

  // Settings
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await api.get("/settings")).data.data
  });

  const taList = useQuery({
    queryKey: ["ta-expenses", canManage ? "all" : "me"],
    queryFn: async () =>
      (await api.get(canManage ? "/ta-expenses/all" : "/ta-expenses/me")).data.data
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await api.put(`/ta-expenses/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta-expenses"] });
      toast.success("Status updated");
    }
  });

  return (
    <div>
      <PageHeader
        title="Claims"
        subtitle="Daily Travel Allowance and Expense Entry"
        actions={
          // Admins only review/verify employee claims — no Settings/Add Entry for them.
          !canManage ? (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Entry
            </Button>
          ) : null
        }
      />

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {taList.isLoading ? (
             <div className="p-4 text-sm text-muted-foreground">Loading...</div>
          ) : (taList.data?.length ?? 0) === 0 ? (
            <div className="p-8">
              <EmptyState icon={Map} title="No TA entries" description="Add your first travel expense." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Bus Fare</TableHead>
                  <TableHead>Others</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taList.data.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">{dayjs(row.date).format("DD.MM.YYYY")}</TableCell>
                    <TableCell>{row.userName}</TableCell>
                    <TableCell>{row.location}</TableCell>
                    <TableCell>{row.busFare}</TableCell>
                    <TableCell>{row.others}</TableCell>
                    <TableCell className="font-bold">{row.grossTotal}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === 'APPROVED' ? 'default' : row.status === 'REJECTED' ? 'destructive' : 'secondary'}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => setViewRow(row)}>
                          <Eye className="mr-1 h-4 w-4" /> View
                        </Button>
                        {canManage && row.status === "PENDING" && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => updateStatus.mutate({id: row.id, status: 'APPROVED'})}>
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => updateStatus.mutate({id: row.id, status: 'REJECTED'})}>
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
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

      {showForm && (
        <TaEntryModal 
           onClose={() => setShowForm(false)} 
           settings={settingsQuery.data} 
        />
      )}

      {showSettings && (
        <TaSettingsModal
           onClose={() => setShowSettings(false)}
           settings={settingsQuery.data}
        />
      )}

      {viewRow && (
        <TaViewModal row={viewRow} onClose={() => setViewRow(null)} />
      )}
    </div>
  );
}

function TaViewModal({ row, onClose }: { row: any; onClose: () => void }) {
  const photos: { label: string; path: string }[] = [];
  if (row.petrolSlipPath) photos.push({ label: "Petrol Slip", path: row.petrolSlipPath });
  (row.photos ? String(row.photos).split(",") : [])
    .map((p: string) => p.trim())
    .filter(Boolean)
    .forEach((p: string, i: number) => photos.push({ label: `Photo ${i + 1}`, path: p }));

  const Field = ({ label, value }: { label: string; value: any }) => (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value === 0 || value ? String(value) : "—"}</div>
    </div>
  );

  return (
    <Dialog open onClose={onClose} className="max-w-2xl">
      <DialogHeader
        title="Travel Expense Details"
        description={`${row.userName || "Employee"} · ${dayjs(row.date).format("DD MMM YYYY")}`}
      />

      <div className="mb-4 flex items-center gap-2">
        <Badge variant={row.status === "APPROVED" ? "default" : row.status === "REJECTED" ? "destructive" : "secondary"}>
          {row.status}
        </Badge>
        <span className="text-sm font-bold">Gross ₹{row.grossTotal}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <Field label="Location" value={row.location} />
        <Field label="Bus Fare" value={row.busFare} />
        <Field label="Others" value={row.others} />
        <Field label="Remarks" value={row.remarks} />
      </div>

      <div className="mt-5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Uploaded Photos ({photos.length})
        </div>
        {photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No photos uploaded for this claim.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((ph, i) => {
              const url = resolvePhotoUrl(ph.path);
              return (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block overflow-hidden rounded-lg border bg-muted/30"
                  title="Open full size"
                >
                  <img
                    src={url}
                    alt={ph.label}
                    className="h-32 w-full object-cover transition-transform group-hover:scale-105"
                    onError={(e) => { (e.currentTarget.style.display = "none"); }}
                  />
                  <div className="px-2 py-1 text-center text-[11px] font-medium text-muted-foreground">{ph.label}</div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end border-t pt-4">
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
    </Dialog>
  );
}

function TaEntryModal({ onClose, settings }: { onClose: () => void, settings: any }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    date: dayjs().format("YYYY-MM-DD"),
    location: "",
    startingKm: 0,
    endingKm: 0,
    hillsKm: 0,
    plainsKm: 0,
    busFare: 0,
    others: 0,
    remarks: "",
    petrolSlipPath: "",
    photos: ""
  });

  const petrolSlipInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPetrol, setUploadingPetrol] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const handlePetrolSlipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPetrol(true);
    const toastId = toast.loading("Uploading petrol slip...");
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await api.post("/ta-expenses/upload", data, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const path = res.data?.data?.path || res.data?.path;
      if (path) {
        setFormData(prev => ({ ...prev, petrolSlipPath: path }));
        toast.success("Petrol slip uploaded successfully!", { id: toastId });
      } else {
        throw new Error("Invalid response");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload petrol slip.", { id: toastId });
    } finally {
      setUploadingPetrol(false);
    }
  };

  const handlePhotosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingPhotos(true);
    const toastId = toast.loading(`Uploading ${files.length} photo(s)...`);
    try {
      const uploadedPaths: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const data = new FormData();
        data.append("file", files[i]);
        const res = await api.post("/ta-expenses/upload", data, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        const path = res.data?.data?.path || res.data?.path;
        if (path) {
          uploadedPaths.push(path);
        }
      }
      if (uploadedPaths.length > 0) {
        setFormData(prev => {
          const currentPhotos = prev.photos ? prev.photos.split(",").filter(Boolean) : [];
          const newPhotos = [...currentPhotos, ...uploadedPaths].join(",");
          return { ...prev, photos: newPhotos };
        });
        toast.success("Photos uploaded successfully!", { id: toastId });
      } else {
        throw new Error("No photos uploaded");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload photos.", { id: toastId });
    } finally {
      setUploadingPhotos(false);
    }
  };

  const removePhoto = (pathToRemove: string) => {
    setFormData(prev => {
      const currentPhotos = prev.photos ? prev.photos.split(",").filter(Boolean) : [];
      const updated = currentPhotos.filter(p => p !== pathToRemove).join(",");
      return { ...prev, photos: updated };
    });
  };

  const hillsRate = parseFloat(settings?.HILLS_KM_RATE || "0");
  const plainsRate = parseFloat(settings?.PLAINS_KM_RATE || "0");

  const totalKm = Math.max(0, formData.endingKm - formData.startingKm);
  const totalAmount = (formData.hillsKm * hillsRate) + (formData.plainsKm * plainsRate);
  const grossTotal = totalAmount + Number(formData.busFare) + Number(formData.others);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post("/ta-expenses", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta-expenses"] });
      toast.success("Entry saved successfully");
      onClose();
    },
    onError: (err) => {
      toast.error(apiMessage(err, "Failed to save"));
    }
  });

  return (
    <Dialog open={true} onClose={onClose}>
      <DialogHeader title="Add TA Expense Entry" />
      <div className="grid grid-cols-2 gap-4 mt-4 max-h-[65vh] overflow-y-auto px-1">
        <div>
          <label className="text-xs">Date</label>
          <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
        </div>
        <div>
          <label className="text-xs">Location</label>
          <Input value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
        </div>

        {/* Petrol Slip Upload */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">
            Petrol Slip Upload
          </label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={uploadingPetrol}
              onClick={() => petrolSlipInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs h-9 w-full justify-start"
            >
              <Upload className="h-4 w-4" />
              {uploadingPetrol ? "Uploading..." : "Select Petrol Slip"}
            </Button>
            <input
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              ref={petrolSlipInputRef}
              onChange={handlePetrolSlipUpload}
            />
          </div>
          {formData.petrolSlipPath && (
            <div className="flex items-center justify-between gap-2 text-xs bg-muted px-2 py-1 rounded mt-1.5">
              <span className="font-mono text-muted-foreground truncate max-w-[120px]">
                {formData.petrolSlipPath.split("/").pop()}
              </span>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, petrolSlipPath: "" }))}
                className="text-destructive hover:text-destructive/80 font-bold"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Multiple Photos Upload */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">
            Add More Expense Photos
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={uploadingPhotos}
            onClick={() => photosInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs h-9 w-full justify-start"
          >
            <Upload className="h-4 w-4" />
            {uploadingPhotos ? "Uploading..." : "Upload Photos"}
          </Button>
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            ref={photosInputRef}
            onChange={handlePhotosUpload}
          />
        </div>

        {/* Multiple Photos Preview */}
        {formData.photos && (
          <div className="col-span-2 mt-1">
            <div className="grid grid-cols-4 gap-2 border p-2 rounded-md bg-muted/20">
              {formData.photos.split(",").filter(Boolean).map((p, idx) => (
                <div key={idx} className="relative group border rounded overflow-hidden aspect-video bg-background flex items-center justify-center">
                  <img 
                    src={`${import.meta.env.VITE_API_URL || ""}${p}`}
                    alt="Travel photo" 
                    className="object-cover w-full h-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = p;
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(p)}
                    className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 opacity-90 transition-opacity"
                    title="Remove image"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs">Bus Fare</label>
          <Input type="number" value={formData.busFare || ''} onChange={e => setFormData({...formData, busFare: Number(e.target.value)})} />
        </div>
        <div className="col-span-2">
          <label className="text-xs">Remarks</label>
          <Input value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} />
        </div>
      </div>
      
      <div className="mt-4 p-3 bg-muted rounded-md flex justify-end font-medium">
         <span className="text-primary font-bold">Gross Total: ₹{grossTotal.toFixed(2)}</span>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => saveMutation.mutate({...formData, totalKm, totalAmount, grossTotal})}>
          Save Entry
        </Button>
      </div>
    </Dialog>
  );
}

function TaSettingsModal({ onClose, settings }: { onClose: () => void, settings: any }) {
  const queryClient = useQueryClient();
  const [hills, setHills] = useState(settings?.HILLS_KM_RATE || "");
  const [plains, setPlains] = useState(settings?.PLAINS_KM_RATE || "");

  const saveSettings = useMutation({
    mutationFn: async () => {
      await api.post("/settings", {
        HILLS_KM_RATE: hills,
        PLAINS_KM_RATE: plains
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
      onClose();
    }
  });

  return (
    <Dialog open={true} onClose={onClose}>
      <DialogHeader title="TA Settings" />
      <div className="space-y-4 mt-4">
        <div>
          <label className="text-sm">Hills KM Rate (₹)</label>
          <Input type="number" value={hills} onChange={e => setHills(e.target.value)} />
        </div>
        <div>
          <label className="text-sm">Plains KM Rate (₹)</label>
          <Input type="number" value={plains} onChange={e => setPlains(e.target.value)} />
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => saveSettings.mutate()}>Save Settings</Button>
      </div>
    </Dialog>
  );
}
