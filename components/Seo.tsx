
import React, { useEffect } from 'react';

interface SeoProps {
    title: string;
    description?: string;
    keywords?: string;
    systemSettings?: Record<string, string>;
}

const Seo: React.FC<SeoProps> = ({ title, description, keywords, systemSettings }) => {
    useEffect(() => {
        // Tên hệ thống / Suffix tiêu đề
        const siteName = (systemSettings?.system_name || "GeoMaster").trim();
        const seoTitleSuffix = (systemSettings?.seo_title || siteName).trim();
        
        // Cập nhật Title
        let finalTitle = title;
        if (seoTitleSuffix && seoTitleSuffix !== title) {
            const lowerTitle = title.toLowerCase().trim();
            const lowerSuffix = seoTitleSuffix.toLowerCase().trim();
            if (lowerSuffix.includes(lowerTitle) || lowerTitle.includes(lowerSuffix)) {
                finalTitle = seoTitleSuffix.length > title.length ? seoTitleSuffix : title;
            } else {
                finalTitle = `${title} | ${seoTitleSuffix}`;
            }
        }

        // Tách các phần bằng dấu gạch đứng, làm sạch khoảng trắng, loại bỏ các phần rỗng
        const parts = finalTitle.split('|').map(p => p.trim()).filter(p => p.length > 0);
        
        // Loại bỏ các phần trùng lặp case-insensitive
        const uniqueParts: string[] = [];
        const seen = new Set<string>();
        for (const part of parts) {
            const lowerPart = part.toLowerCase();
            if (!seen.has(lowerPart)) {
                seen.add(lowerPart);
                uniqueParts.push(part);
            }
        }

        document.title = uniqueParts.join(' | ');

        // Cập nhật Meta Description
        const finalDesc = description || systemSettings?.seo_description || "Hệ thống WebGIS GeoMaster - Tra cứu quy hoạch và quản lý đất đai chuyên nghiệp.";
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', "description");
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute('content', finalDesc);

        // Cập nhật Keywords
        const finalKeywords = keywords || systemSettings?.seo_keywords || "webgis, quy hoạch, giá đất, postgis, bản đồ số";
        let metaKeys = document.querySelector('meta[name="keywords"]');
        if (!metaKeys) {
            metaKeys = document.createElement('meta');
            metaKeys.setAttribute('name', "keywords");
            document.head.appendChild(metaKeys);
        }
        metaKeys.setAttribute('content', finalKeywords);

        // Cập nhật Open Graph (Mạng xã hội)
        let ogTitle = document.querySelector('meta[property="og:title"]');
        if (!ogTitle) { ogTitle = document.createElement('meta'); ogTitle.setAttribute('property', "og:title"); document.head.appendChild(ogTitle); }
        ogTitle.setAttribute('content', document.title);
        
        let ogDesc = document.querySelector('meta[property="og:description"]');
        if (!ogDesc) { ogDesc = document.createElement('meta'); ogDesc.setAttribute('property', "og:description"); document.head.appendChild(ogDesc); }
        ogDesc.setAttribute('content', finalDesc);
        
        if (systemSettings?.seo_og_image) {
            let ogImg = document.querySelector('meta[property="og:image"]');
            if (!ogImg) { ogImg = document.createElement('meta'); ogImg.setAttribute('property', "og:image"); document.head.appendChild(ogImg); }
            ogImg.setAttribute('content', systemSettings.seo_og_image);
        }

        // Cập nhật Favicon động
        if (systemSettings?.site_favicon) {
            let favicon = document.getElementById('favicon') as HTMLLinkElement;
            if (!favicon) {
                favicon = document.createElement('link');
                favicon.id = 'favicon';
                favicon.rel = 'icon';
                document.head.appendChild(favicon);
            }
            favicon.href = systemSettings.site_favicon;
        }

    }, [title, description, keywords, systemSettings]);

    return null;
};

export default Seo;
