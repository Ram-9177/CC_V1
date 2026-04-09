import React, { useEffect, useRef } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
}

/**
 * SEO Component for dynamic metadata updates.
 * Updates document.title and meta description tags reliably in SPAs.
 * Includes cleanup on unmount to prevent title leakage.
 */
export const SEO = React.memo(({ 
  title, 
  description, 
  keywords 
}: SEOProps) => {
  const originalTitleRef = useRef(document.title);

  useEffect(() => {
    // 1. Update Title
    const baseTitle = 'Campus Core';
    const finalTitle = title ? `${title} | ${baseTitle}` : `${baseTitle} | Smart Management ERP`;
    document.title = finalTitle;

    // 2. Update Description
    const metaDescription = document.querySelector('meta[name="description"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    
    if (description) {
      if (metaDescription) metaDescription.setAttribute('content', description);
      if (ogDescription) ogDescription.setAttribute('content', description);
    }

    // 3. Update Keywords
    if (keywords) {
      const metaKeywords = document.querySelector('meta[name="keywords"]');
      if (metaKeywords) metaKeywords.setAttribute('content', keywords);
    }
    
    // 4. Update OpenGraph Title
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', title || finalTitle);
    }

    return () => {
      // Cleanup: Revert to the title captured on mount or before this component was active.
      if (originalTitleRef.current) {
        document.title = originalTitleRef.current;
      }
    };
  }, [title, description, keywords]);

  return null; // Side-effect only component
});

SEO.displayName = 'SEO';
