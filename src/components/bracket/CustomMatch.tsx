

interface Participant {
    id: string;
    name: string;
    score?: number | null;
    isWinner?: boolean;
    resultText?: string | null;
}

interface MatchProps {
    match: {
        id: number;
        name: string;
        participants: Participant[];
        tournamentRoundText: string;
        state: string;
    };
    onMatchClick?: (match: any) => void;
    onPartyClick?: (party: any, partyWon: boolean) => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    topParty?: Participant;
    bottomParty?: Participant;
    topWon?: boolean;
    bottomWon?: boolean;
    topHovered?: boolean;
    bottomHovered?: boolean;
    topText?: string;
    bottomText?: string;
    connectorColor?: string;
    computedStyles?: any;
    teamNameFallback?: string;
    resultFallback?: (participant: Participant) => string;
}

export function CustomMatch({
    match,
    onMatchClick,
    topParty,
    bottomParty,
    topWon,
    bottomWon,
}: MatchProps) {
    const handleClick = () => {
        if (onMatchClick) {
            onMatchClick(match);
        }
    };

    return (
        <div
            onClick={handleClick}
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '240px',
                cursor: 'pointer',
                fontFamily: 'inherit',
            }}
        >
            {/* Top Team */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 10px',
                    backgroundColor: topWon ? '#10b981' : '#374151',
                    border: '1px solid #6b7280',
                    borderBottom: 'none',
                    borderTopLeftRadius: '4px',
                    borderTopRightRadius: '4px',
                    minHeight: '28px',
                }}
            >
                <span
                    style={{
                        color: topWon ? '#ffffff' : '#f5f5f5',
                        fontWeight: topWon ? 600 : 500,
                        fontSize: '14px',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {topParty?.name || 'TBD'}
                </span>
                {topParty?.score !== null && topParty?.score !== undefined && (
                    <span
                        style={{
                            color: topWon ? '#ffffff' : '#fbbf24',
                            fontWeight: 600,
                            fontSize: '14px',
                            marginLeft: '8px',
                            minWidth: '24px',
                            textAlign: 'right',
                        }}
                    >
                        {topParty.score}
                    </span>
                )}
            </div>

            {/* Bottom Team */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 10px',
                    backgroundColor: bottomWon ? '#10b981' : '#374151',
                    border: '1px solid #6b7280',
                    borderBottomLeftRadius: '4px',
                    borderBottomRightRadius: '4px',
                    minHeight: '28px',
                }}
            >
                <span
                    style={{
                        color: bottomWon ? '#ffffff' : '#f5f5f5',
                        fontWeight: bottomWon ? 600 : 500,
                        fontSize: '14px',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {bottomParty?.name || 'TBD'}
                </span>
                {bottomParty?.score !== null && bottomParty?.score !== undefined && (
                    <span
                        style={{
                            color: bottomWon ? '#ffffff' : '#fbbf24',
                            fontWeight: 600,
                            fontSize: '14px',
                            marginLeft: '8px',
                            minWidth: '24px',
                            textAlign: 'right',
                        }}
                    >
                        {bottomParty.score}
                    </span>
                )}
            </div>
        </div>
    );
}
