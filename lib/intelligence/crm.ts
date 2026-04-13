// /lib/intelligence/crm.ts

interface CRMRecord {
    companyName: string;
    confidence: string;
    reviewStatus: string;
}

export function isCRMReady(record: CRMRecord): boolean {
    return (
        !!record.companyName &&
        record.confidence !== "Low" &&
        record.reviewStatus === "Approved"
    );
}