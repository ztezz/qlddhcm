export type AdminPanelStyle = 'LIGHT' | 'DARK' | 'MINIMAL';

export interface AdminPanelTheme {
    triggerButton: string;
    triggerBadge: string;
    panelShell: string;
    headingText: string;
    closeButton: string;
    tabWrap: string;
    tabSearchActive: string;
    tabLayersActive: string;
    tabIdle: string;
    field: string;
    actionBtn: string;
    divider: string;
    countPill: string;
    listWrap: string;
    cardActive: string;
    cardIdle: string;
    subText: string;
    typeInteractive: string;
    typeRaster: string;
    statusOn: string;
    statusOff: string;
    activePill: string;
    eyeOn: string;
    eyeOff: string;
    activeBox: string;
    activeBoxTitle: string;
    zoomBtn: string;
    note: string;
    suggestBox: string;
    suggestItem: string;
    emptyBox: string;
}

export const getAdminPanelTheme = (panelStyle: AdminPanelStyle): AdminPanelTheme => {
    if (panelStyle === 'DARK') {
        return {
            triggerButton: 'bg-slate-950/90 text-cyan-300 border-slate-700',
            triggerBadge: 'bg-cyan-600 text-white border-slate-900',
            panelShell: 'bg-slate-950/90 border-slate-700 text-slate-100',
            headingText: 'text-cyan-300',
            closeButton: 'bg-slate-900/70 text-slate-300 hover:text-white hover:bg-slate-800',
            tabWrap: 'bg-slate-900/70 border-slate-700',
            tabSearchActive: 'bg-cyan-600 text-white',
            tabLayersActive: 'bg-emerald-600 text-white',
            tabIdle: 'text-slate-300 hover:bg-slate-800',
            field: 'bg-slate-900 border-slate-700 text-white focus:border-cyan-500',
            actionBtn: 'bg-cyan-600 hover:bg-cyan-500 text-white',
            divider: 'border-slate-800',
            countPill: 'text-slate-300 bg-slate-800/80 border-slate-700',
            listWrap: 'border-slate-700 bg-slate-900/40',
            cardActive: 'border-cyan-500/60 bg-cyan-900/20 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]',
            cardIdle: 'border-slate-700 bg-slate-900/60 hover:border-slate-500',
            subText: 'text-slate-400',
            typeInteractive: 'border-cyan-500/40 text-cyan-300',
            typeRaster: 'border-amber-500/40 text-amber-300',
            statusOn: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
            statusOff: 'border-slate-600 text-slate-300 bg-slate-700/20',
            activePill: 'border-cyan-500/40 text-cyan-200 bg-cyan-500/10',
            eyeOn: 'bg-rose-600 text-white hover:bg-rose-500',
            eyeOff: 'bg-cyan-700 text-white hover:bg-cyan-600',
            activeBox: 'border-slate-700 bg-slate-900/70',
            activeBoxTitle: 'text-cyan-300',
            zoomBtn: 'bg-slate-800 text-slate-200 hover:bg-slate-700',
            note: 'text-slate-400',
            suggestBox: 'border-slate-700 bg-slate-900/95',
            suggestItem: 'text-slate-200 hover:bg-slate-800',
            emptyBox: 'text-slate-400 border-slate-700'
        };
    }

    if (panelStyle === 'MINIMAL') {
        return {
            triggerButton: 'bg-white/92 text-slate-700 border-slate-300',
            triggerBadge: 'bg-slate-700 text-white border-white',
            panelShell: 'bg-white/92 border-slate-300 text-slate-800',
            headingText: 'text-slate-700',
            closeButton: 'bg-slate-100 text-slate-600 hover:text-slate-800 hover:bg-slate-200',
            tabWrap: 'bg-slate-100 border-slate-200',
            tabSearchActive: 'bg-white text-slate-700 border border-slate-300',
            tabLayersActive: 'bg-white text-slate-700 border border-slate-300',
            tabIdle: 'text-slate-500 hover:bg-slate-200',
            field: 'bg-white border-slate-300 text-slate-800 focus:border-slate-500',
            actionBtn: 'bg-slate-700 hover:bg-slate-600 text-white',
            divider: 'border-slate-200',
            countPill: 'text-slate-600 bg-slate-100 border-slate-300',
            listWrap: 'border-slate-300 bg-slate-50/80',
            cardActive: 'border-slate-500 bg-white shadow-sm',
            cardIdle: 'border-slate-300 bg-white hover:border-slate-400',
            subText: 'text-slate-500',
            typeInteractive: 'border-slate-400 text-slate-600',
            typeRaster: 'border-slate-400 text-slate-600',
            statusOn: 'border-slate-400 text-slate-700 bg-slate-100',
            statusOff: 'border-slate-300 text-slate-500 bg-slate-100/70',
            activePill: 'border-slate-400 text-slate-700 bg-slate-100',
            eyeOn: 'bg-slate-700 text-white hover:bg-slate-600',
            eyeOff: 'bg-slate-200 text-slate-700 hover:bg-slate-300',
            activeBox: 'border-slate-300 bg-white',
            activeBoxTitle: 'text-slate-700',
            zoomBtn: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
            note: 'text-slate-500',
            suggestBox: 'border-slate-300 bg-white',
            suggestItem: 'text-slate-700 hover:bg-slate-100',
            emptyBox: 'text-slate-500 border-slate-300'
        };
    }

    return {
        triggerButton: 'bg-white/85 text-blue-700 border-blue-100',
        triggerBadge: 'bg-blue-600 text-white border-white',
        panelShell: 'bg-white/78 border-blue-100 text-slate-800',
        headingText: 'text-blue-700',
        closeButton: 'bg-white/80 text-slate-500 hover:text-slate-700 hover:bg-white',
        tabWrap: 'bg-blue-50/80 border-blue-100',
        tabSearchActive: 'bg-blue-600 text-white',
        tabLayersActive: 'bg-teal-600 text-white',
        tabIdle: 'text-slate-600 hover:bg-white/80',
        field: 'bg-white/85 border-blue-100 text-slate-800 focus:border-blue-400',
        actionBtn: 'bg-blue-600 hover:bg-blue-500 text-white',
        divider: 'border-blue-100',
        countPill: 'text-slate-600 bg-white/70 border-blue-100',
        listWrap: 'border-blue-100 bg-white/55',
        cardActive: 'border-blue-300 bg-blue-50/70 shadow-[0_6px_18px_rgba(59,130,246,0.18)]',
        cardIdle: 'border-blue-100 bg-white/80 hover:border-blue-200',
        subText: 'text-slate-500',
        typeInteractive: 'border-blue-200 text-blue-700',
        typeRaster: 'border-amber-300 text-amber-700',
        statusOn: 'border-emerald-300 text-emerald-700 bg-emerald-50',
        statusOff: 'border-slate-300 text-slate-600 bg-slate-50',
        activePill: 'border-blue-300 text-blue-700 bg-blue-100/70',
        eyeOn: 'bg-rose-500 text-white hover:bg-rose-400',
        eyeOff: 'bg-blue-600 text-white hover:bg-blue-500',
        activeBox: 'border-blue-100 bg-white/85',
        activeBoxTitle: 'text-blue-700',
        zoomBtn: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
        note: 'text-slate-500',
        suggestBox: 'border-blue-100 bg-white/95',
        suggestItem: 'text-slate-700 hover:bg-blue-50',
        emptyBox: 'text-slate-500 border-blue-100'
    };
};