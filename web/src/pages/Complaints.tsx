import { useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  Loader2, Plus, Inbox, ChevronLeft, ChevronRight, Send
} from "lucide-react";
import toast from "react-hot-toast";
import { api, apiMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import type { ApiEnvelope, PageEnvelope, ComplaintNeed } from "@/types";
import dayjs from "dayjs";

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "RESOLVED":
      return "default";
    case "REJECTED":
      return "destructive";
    case "IN_REVIEW":
      return "secondary";
    default:
      return "outline";
  }
}

function kindLabel(kind: string) {
  return kind === "NEED" ? "Need" : "Complaint";
}

export default function ComplaintsPage() {
  const { hasPermission } = useAuth();
  const canReview = hasPermission("USER_MANAGE");
  const [tab, setTab] = useState<"mine" | "all">("mine");
  const [showSubmit, setShowSubmit] = useState(false);

  return (
    <div>
      <PageHeader
        title="Complaints & Needs"
        subtitle="Raise a complaint or request something you need. HR and admin will review and respond."
        actions={
          <Button onClick={() => setShowSubmit(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Submission
          </Button>
        }
      />

      {canReview && (
        <div className="mb-4 flex gap-2">
          <Button
            variant={tab === "mine" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("mine")}
          >
            My submissions
          </Button>
          <Button
            variant={tab === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("all")}
          >
            All submissions
          </Button>
        </div>
      )}

      {tab === "mine" || !canReview ? <MySubmissions /> : <AllSubmissions />}

      {showSubmit && <SubmitDialog onClose={() => setShowSubmit(false)} />}
    </div>
  );
}

function MySubmissions() {
  const [page, setPage] = useState(0);

  const query = useQuery({
    queryKey: ["complaints", "mine", page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await api.get<ApiEnvelope<PageEnvelope<ComplaintNeed>>>(
        `/complaints/mine?page=${page}&size=10`
      );
      return res.data.data;
    }
  });

  const rows = query.data?.content ?? [];
  const totalPages = query.data?.totalPages ?? 1;

  if (query.isLoading) return <Skeleton className="h-64" />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Nothing submitted yet"
        description="Use “New Submission” to raise a complaint or a need."
      />
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((c) => (
        <SubmissionCard key={c.id} c={c} />
      ))}
      <Pager page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}

function AllSubmissions() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [respondTo, setRespondTo] = useState<ComplaintNeed | null>(null);

  const query = useQuery({
    queryKey: ["complaints", "all", status, kind, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), size: "10" });
      if (status) params.set("status", status);
      if (kind) params.set("kind", kind);
      const res = await api.get<ApiEnvelope<PageEnvelope<ComplaintNeed>>>(
        `/complaints?${params.toString()}`
      );
      return res.data.data;
    }
  });

  const rows = query.data?.content ?? [];
  const totalPages = query.data?.totalPages ?? 1;

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
          <Select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(0);
            }}
            className="sm:w-48"
          >
            <option value="">All types</option>
            <option value="COMPLAINT">Complaints</option>
            <option value="NEED">Needs</option>
          </Select>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
            className="sm:w-48"
          >
            <option value="">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_REVIEW">In review</option>
            <option value="RESOLVED">Resolved</option>
            <option value="REJECTED">Rejected</option>
          </Select>
        </CardContent>
      </Card>

      {query.isLoading ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No submissions found"
          description="Try a different filter."
        />
      ) : (
        <>
          {rows.map((c) => (
            <SubmissionCard key={c.id} c={c} showSubmitter onRespond={() => setRespondTo(c)} />
          ))}
          <Pager page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}

      {respondTo && (
        <RespondDialog
          complaint={respondTo}
          onClose={() => setRespondTo(null)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: ["complaints"] });
            setRespondTo(null);
          }}
        />
      )}
    </div>
  );
}

function SubmissionCard({
  c,
  showSubmitter,
  onRespond
}: {
  c: ComplaintNeed;
  showSubmitter?: boolean;
  onRespond?: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="code-chip text-xs text-muted-foreground">{c.referenceCode}</span>
              <Badge variant={c.kind === "NEED" ? "secondary" : "default"}>
                {kindLabel(c.kind)}
              </Badge>
              {c.category && <Badge variant="outline">{c.category}</Badge>}
              <Badge variant="outline">{c.priority}</Badge>
            </div>
            <h3 className="mt-2 font-medium">{c.subject}</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {c.description}
            </p>
            {showSubmitter && (
              <p className="mt-2 text-xs text-muted-foreground">
                By {c.raisedByName} · {dayjs(c.createdAt).format("DD MMM YYYY, h:mm A")}
              </p>
            )}
          </div>
          <Badge variant={statusVariant(c.status)}>{c.status.replace("_", " ")}</Badge>
        </div>

        {c.hrResponse && (
          <div className="mt-3 rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <div className="mb-0.5 text-xs font-medium text-muted-foreground">
              Response{c.handledByName ? ` · ${c.handledByName}` : ""}
            </div>
            <p className="whitespace-pre-wrap">{c.hrResponse}</p>
          </div>
        )}

        {onRespond && (
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={onRespond}>
              <Send className="mr-2 h-4 w-4" /> Respond
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Pager({
  page,
  totalPages,
  onPage
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPage(Math.max(0, page - 1))}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm">
        {page + 1} / {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page + 1 >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function SubmitDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState("COMPLAINT");
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiEnvelope<ComplaintNeed>>("/complaints", {
        kind,
        category: category.trim() || undefined,
        subject: subject.trim(),
        description: description.trim(),
        priority
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      toast.success("Submitted — HR and admin have been notified");
      onClose();
    },
    onError: (err) => setError(apiMessage(err, "Could not submit"))
  });

  function submit() {
    setError(null);
    if (!subject.trim()) {
      setError("Please add a subject");
      return;
    }
    if (!description.trim()) {
      setError("Please describe your complaint or need");
      return;
    }
    mutation.mutate();
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader
        title="New Complaint / Need"
        description="Tell HR and admin what's wrong or what you need."
      />

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="cn-kind">Type</Label>
            <Select id="cn-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="COMPLAINT">Complaint</option>
              <option value="NEED">Need / Requirement</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cn-priority">Priority</Label>
            <Select id="cn-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="cn-category">Category (optional)</Label>
          <Input
            id="cn-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Facilities, IT, Payroll, Workplace"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="cn-subject">Subject *</Label>
          <Input
            id="cn-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="A short summary"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="cn-desc">Details *</Label>
          <Textarea
            id="cn-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the complaint or what you need…"
            className="min-h-[120px]"
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2 border-t pt-4">
        <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mutation.isPending ? "Submitting…" : "Submit"}
        </Button>
      </div>
    </Dialog>
  );
}

function RespondDialog({
  complaint,
  onClose,
  onDone
}: {
  complaint: ComplaintNeed;
  onClose: () => void;
  onDone: () => void;
}) {
  const [status, setStatus] = useState(complaint.status);
  const [response, setResponse] = useState(complaint.hrResponse ?? "");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiEnvelope<ComplaintNeed>>(
        `/complaints/${complaint.id}/respond`,
        { status, response: response.trim() || undefined }
      );
      return res.data.data;
    },
    onSuccess: () => {
      toast.success("Updated — the employee has been notified");
      onDone();
    },
    onError: (err) => setError(apiMessage(err, "Could not update"))
  });

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader
        title={`Respond · ${complaint.referenceCode}`}
        description={complaint.subject}
      />

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <div className="mb-0.5 text-xs font-medium text-muted-foreground">
            {kindLabel(complaint.kind)} from {complaint.raisedByName}
          </div>
          <p className="whitespace-pre-wrap">{complaint.description}</p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="cn-status">Status</Label>
          <Select id="cn-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="OPEN">Open</option>
            <option value="IN_REVIEW">In review</option>
            <option value="RESOLVED">Resolved</option>
            <option value="REJECTED">Rejected</option>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="cn-response">Response to employee</Label>
          <Textarea
            id="cn-response"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Optional message back to the employee…"
            className="min-h-[100px]"
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2 border-t pt-4">
        <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mutation.isPending ? "Saving…" : "Save response"}
        </Button>
      </div>
    </Dialog>
  );
}
