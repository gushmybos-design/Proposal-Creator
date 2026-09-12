import React, { useEffect, useState } from "react";
import {
  hubspot,
  Button,
  ButtonRow,
  Divider,
  EmptyState,
  ErrorState,
  Flex,
  Link,
  LoadingSpinner,
  StatusTag,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from "@hubspot/ui-extensions";

/**
 * Propel — proposals card on the HubSpot Deal record (React UI extension).
 *
 * Talks to Propel over hubspot.fetch(); HubSpot signs every request with the app's client
 * secret (X-HubSpot-Signature-v3), which Propel verifies, so no extra login is needed.
 * Replace PROPEL_URL below (or inject via build) with your deployment.
 */
const PROPEL_URL = "https://YOUR-PROPEL-DOMAIN";

const STATUS_VARIANT = {
  DRAFT: "default",
  PUBLISHED: "info",
  VIEWED: "info",
  ACCEPTED: "success",
  DECLINED: "danger",
  CHANGES_REQUESTED: "warning",
  EXPIRED: "warning",
};

hubspot.extend(({ context, actions }) => <ProposalsCard context={context} actions={actions} />);

function ProposalsCard({ context, actions }) {
  const dealId = context.crm.objectId;
  const portalId = context.portal.id;
  const userEmail = context.user.email;
  const [state, setState] = useState({ loading: true, error: null, proposals: [], templates: [] });
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await hubspot.fetch(`${PROPEL_URL}/api/hubspot/ext/proposals?dealId=${dealId}&portalId=${portalId}`, { method: "GET" });
      if (!res.ok) throw new Error(`Propel responded ${res.status}`);
      const json = await res.json();
      setState({ loading: false, error: null, proposals: json.proposals ?? [], templates: json.templates ?? [] });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message }));
    }
  };
  useEffect(() => {
    load();
  }, [dealId]);

  const createProposal = async (templateId) => {
    setCreating(true);
    try {
      const res = await hubspot.fetch(`${PROPEL_URL}/api/hubspot/ext/proposals`, {
        method: "POST",
        body: { dealId: String(dealId), portalId: String(portalId), userEmail, templateId },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Propel responded ${res.status}`);
      actions.openIframeModal({ uri: json.editUrl, width: 1280, height: 860, title: "Edit proposal", flush: true });
      actions.addAlert({ type: "success", message: "Proposal created — edit it in the window that opened." });
      await load();
    } catch (e) {
      actions.addAlert({ type: "danger", message: e.message });
    } finally {
      setCreating(false);
    }
  };

  if (state.loading) return <LoadingSpinner label="Loading proposals…" />;
  if (state.error) {
    return (
      <ErrorState title="Couldn't reach Propel">
        <Text>{state.error}</Text>
        <Button onClick={load}>Retry</Button>
      </ErrorState>
    );
  }

  return (
    <Flex direction="column" gap="medium">
      <ButtonRow>
        {state.templates.slice(0, 3).map((t) => (
          <Button key={t.id} variant="primary" disabled={creating} onClick={() => createProposal(t.id)}>
            New from “{t.name}”
          </Button>
        ))}
        <Button variant="secondary" disabled={creating} onClick={() => createProposal(undefined)}>
          New blank proposal
        </Button>
      </ButtonRow>
      <Divider />
      {state.proposals.length === 0 ? (
        <EmptyState title="No proposals for this deal yet" layout="vertical" reverseOrder>
          <Text>Create one from a template above — client, company and line items are pulled in automatically.</Text>
        </EmptyState>
      ) : (
        <Table bordered>
          <TableHead>
            <TableRow>
              <TableHeader>Proposal</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Views</TableHeader>
              <TableHeader>Time viewed</TableHeader>
              <TableHeader>Updated</TableHeader>
              <TableHeader></TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {state.proposals.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link href={p.analyticsUrl}>{p.title}</Link>
                </TableCell>
                <TableCell>
                  <StatusTag variant={STATUS_VARIANT[p.status] ?? "default"}>{p.statusLabel}</StatusTag>
                </TableCell>
                <TableCell>{p.views}</TableCell>
                <TableCell>{p.timeViewed}</TableCell>
                <TableCell>{p.updatedAt}</TableCell>
                <TableCell>
                  <ButtonRow>
                    <Button size="xs" onClick={() => actions.openIframeModal({ uri: p.editUrl, width: 1280, height: 860, title: p.title, flush: true })}>
                      Edit
                    </Button>
                    <Button size="xs" variant="secondary" onClick={() => actions.openIframeModal({ uri: p.previewUrl, width: 1100, height: 860, title: "Preview", flush: true })}>
                      Preview
                    </Button>
                    {p.status !== "DRAFT" && (
                      <Button size="xs" variant="secondary" href={p.publicUrl}>
                        Client link
                      </Button>
                    )}
                  </ButtonRow>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Flex>
  );
}
