import React from 'react';
import '../styles/skeleton.css';

export function MessageSkeleton() {
    return (
        <div className="message-skeleton">
            <div className="skeleton-avatar"></div>
            <div className="skeleton-content">
                <div className="skeleton-line short"></div>
                <div className="skeleton-line long"></div>
                <div className="skeleton-line medium"></div>
            </div>
        </div>
    );
}

export function TableSkeleton() {
    return (
        <div className="table-skeleton">
            <div className="skeleton-header">
                <div className="skeleton-cell"></div>
                <div className="skeleton-cell"></div>
                <div className="skeleton-cell"></div>
                <div className="skeleton-cell"></div>
            </div>
            <div className="skeleton-row">
                <div className="skeleton-cell"></div>
                <div className="skeleton-cell"></div>
                <div className="skeleton-cell"></div>
                <div className="skeleton-cell"></div>
            </div>
            <div className="skeleton-row">
                <div className="skeleton-cell"></div>
                <div className="skeleton-cell"></div>
                <div className="skeleton-cell"></div>
                <div className="skeleton-cell"></div>
            </div>
            <div className="skeleton-row">
                <div className="skeleton-cell"></div>
                <div className="skeleton-cell"></div>
                <div className="skeleton-cell"></div>
                <div className="skeleton-cell"></div>
            </div>
        </div>
    );
}

export function FormSkeleton() {
    return (
        <div className="form-skeleton">
            <div className="skeleton-input"></div>
            <div className="skeleton-input"></div>
            <div className="skeleton-input"></div>
            <div className="skeleton-button"></div>
        </div>
    );
}
