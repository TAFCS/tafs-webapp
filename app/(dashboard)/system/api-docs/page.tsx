import { Suspense } from "react";
import ApiDocs from "@/features/api-docs/ApiDocs";

/** TAFSD-614: the API Docs tile (system.api_docs), default-deny like every web tile. */
export default function ApiDocsPage() {
    return (
        <Suspense>
            <ApiDocs />
        </Suspense>
    );
}
