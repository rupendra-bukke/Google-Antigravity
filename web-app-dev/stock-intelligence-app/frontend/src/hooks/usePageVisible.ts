"use client";

import { useEffect, useState } from "react";

export function usePageVisible(): boolean {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const update = () => setVisible(!document.hidden);
        update();
        document.addEventListener("visibilitychange", update);
        return () => document.removeEventListener("visibilitychange", update);
    }, []);

    return visible;
}
