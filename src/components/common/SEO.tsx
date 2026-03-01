import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
}

/**
 * SEO Component for dynamic metadata updates.
 * Updates document.title and meta description tags reliably in SPAs.
 */
export const SEO = ({ 
  title, 
  description, 
  keywords 
}: SEOProps) => {
  useEffect(() => {
    // 1. Update Title
    const baseTitle = 'SMG Hostel Connect';
    const finalTitle = title ? `${title} | ${baseTitle}` : `${baseTitle} | Smart Management ERP`;
    document.title = finalTitle;

    // 2. Update Description
    if (description) {
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', description);
      }
      
      const ogDescription = document.querySelector('meta[property="og:description"]');
      if (ogDescription) {
        ogDescription.setAttribute('content', description);
      }
    }

    // 3. Update Keywords
    if (keywords) {
      const metaKeywords = document.querySelector('meta[name="keywords"]');
      if (metaKeywords) {
        metaKeywords.setAttribute('content', keywords);
      }
    }
    
    // 4. Update OpenGraph Title
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', title || finalTitle);
    }

  }, [title, description, keywords]);

  return null; // Side-effect only component
};
