"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import TextArea from "@/components/form/input/TextArea";
import { toUserFacingError } from "@/lib/userFacingError";
import { SESSION_EXPIRED_MESSAGE } from "../../../../../convex/lib/authConstants";
import {
  CLINICAL_NOTE_MAX_LENGTH,
  CLINICAL_NOTE_MIN_LENGTH,
} from "../../../../../convex/lib/clinicalNoteConstants";
import { formatRequestTime } from "../../_components/accessLabels";

type ClinicalNotePanelProps = {
  requestId: string;
  originatingFacility: string;
};

export function ClinicalNotePanel({
  requestId,
  originatingFacility,
}: ClinicalNotePanelProps) {
  const { sessionToken } = useAuth();
  const notes = useQuery(
    api.clinicalNotes.listClinicalNotesForRequest,
    sessionToken ? { token: sessionToken, requestId } : "skip",
  );
  const appendNote = useMutation(api.clinicalNotes.appendClinicalNoteAfterAllow);
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const trimmedBody = body.trim();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    if (!sessionToken) {
      setErrorMessage(SESSION_EXPIRED_MESSAGE);
      return;
    }
    if (trimmedBody.length < CLINICAL_NOTE_MIN_LENGTH) {
      setErrorMessage(`Write at least ${CLINICAL_NOTE_MIN_LENGTH} characters.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await appendNote({ token: sessionToken, requestId, body: trimmedBody });
      setBody("");
    } catch (error) {
      console.error("Error appending clinical note:", error);
      setErrorMessage(toUserFacingError(error, "The note could not be saved. Try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Append a short synthetic note after ALLOW. This is not a hospital chart
        editor. Originating facility: {originatingFacility}.
      </p>

      {notes && notes.length > 0 && (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li
              key={note.noteId}
              className="rounded-lg border border-gray-100 p-3 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-300"
            >
              <p>{note.body}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {formatRequestTime(note.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {errorMessage && (
          <Alert variant="error" title="Note not saved" message={errorMessage} />
        )}
        <div>
          <Label htmlFor="clinical-note-body">Clinical note</Label>
          <TextArea
            id="clinical-note-body"
            name="clinicalNote"
            rows={3}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="What was recorded after authorised access?"
            disabled={isSubmitting}
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {trimmedBody.length}/{CLINICAL_NOTE_MAX_LENGTH} characters · at least{" "}
            {CLINICAL_NOTE_MIN_LENGTH}
          </p>
        </div>
        <Button type="submit" disabled={isSubmitting || !sessionToken}>
          {isSubmitting ? "Saving…" : "Append note"}
        </Button>
      </form>
    </div>
  );
}
