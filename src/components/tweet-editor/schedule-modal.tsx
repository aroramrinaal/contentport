'use client'

import * as React from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DayFlag, DayPicker, UI } from 'react-day-picker'
import { cn } from '@/lib/utils'
import DuolingoButton from '../ui/duolingo-button'
import DuolingoInput from '../ui/duolingo-input'
import { Clock, Calendar as CalendarIcon, Zap } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'

export interface ScheduleModalProps {
  onSchedule?: (date: Date, time: string) => void
  onQueue?: () => void
  isPending?: boolean
  isQueueing?: boolean
  initialScheduledTime?: Date
  editMode?: boolean
  onClose?: () => void
}

export const ScheduleModal = ({
  onSchedule,
  onQueue,
  isPending,
  isQueueing,
  initialScheduledTime,
  editMode,
  onClose,
}: ScheduleModalProps) => {
  const today = new Date()
  const currentHour = today.getHours()
  const currentMinute = today.getMinutes()

  const timeSlots = Array.from({ length: 37 }, (_, i) => {
    const totalMinutes = i * 15
    const hour = Math.floor(totalMinutes / 60) + 9
    const minute = totalMinutes % 60
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
  })

  const getNextAvailableTime = (): string => {
    const currentTime = currentHour * 60 + currentMinute
    return (
      timeSlots.find((timeSlot) => {
        const timeParts = timeSlot.split(':').map(Number)
        const hour = timeParts[0] ?? 0
        const minute = timeParts[1] ?? 0
        const slotTime = hour * 60 + minute
        return slotTime > currentTime
      }) ??
      timeSlots[0] ??
      '10:00'
    )
  }

  const getInitialDate = (): Date => {
    return initialScheduledTime ? new Date(initialScheduledTime) : new Date()
  }

  const getInitialTime = (): string => {
    if (initialScheduledTime) {
      const scheduledDate = new Date(initialScheduledTime)
      const hour = scheduledDate.getHours().toString().padStart(2, '0')
      const minute = scheduledDate.getMinutes().toString().padStart(2, '0')
      return `${hour}:${minute}`
    }
    return getNextAvailableTime()
  }

  const [date, setDate] = React.useState<Date | undefined>(getInitialDate())
  const [selectedTime, setSelectedTime] = React.useState<string | null>(
    getInitialTime(),
  )
  const [customTime, setCustomTime] = React.useState<string>('')
  const [useCustomTime, setUseCustomTime] = React.useState<boolean>(false)
  const [selectedOption, setSelectedOption] = React.useState<'queue' | 'custom' | 'manual'>('queue')

  const isTimeSlotDisabled = (timeString: string) => {
    if (!date || date.toDateString() !== today.toDateString()) {
      return false
    }

    const timeParts = timeString.split(':').map(Number)
    const hour = timeParts[0] ?? 0
    const minute = timeParts[1] ?? 0
    const slotTime = hour * 60 + minute
    const currentTime = currentHour * 60 + currentMinute

    return slotTime <= currentTime
  }

  const isPastDate = (date: Date) => {
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    return dateOnly < todayOnly
  }

  const validateCustomTime = (time: string): boolean => {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    return timeRegex.test(time)
  }

  const handleCustomTimeChange = (value: string) => {
    setCustomTime(value)
    if (validateCustomTime(value)) {
      setSelectedTime(value)
      setUseCustomTime(true)
    }
  }

  const handleTimeSlotClick = (time: string) => {
    setSelectedTime(time)
    setUseCustomTime(false)
    setCustomTime('')
  }

  const getCurrentTimeValue = (): string => {
    if (useCustomTime && customTime) {
      return customTime
    }
    return selectedTime || ''
  }

  const handleQueueClick = () => {
    if (onQueue) {
      onQueue()
    }
  }

  const handleScheduleClick = () => {
    if (date && getCurrentTimeValue() && onSchedule) {
      onSchedule(date, getCurrentTimeValue())
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="size-5" />
            {editMode ? 'Reschedule Tweet' : 'Schedule Tweet'}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            {/* Left Side - Calendar */}
            <div className="p-6 border-r">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-stone-900">Select Date</h3>
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  defaultMonth={date}
                  disabled={isPastDate}
                  showOutsideDays={false}
                  startMonth={today}
                  className="p-0"
                  formatters={{
                    formatWeekdayName: (date) => {
                      return date.toLocaleString('en-US', { weekday: 'short' })
                    },
                  }}
                  classNames={{
                    day: 'size-12 rounded-xl',
                    selected: 'z-10 rounded-md',
                    [UI.Months]: 'relative',
                    [UI.Month]: 'space-y-4 ml-0',
                    [UI.MonthCaption]: 'flex w-full justify-center items-center h-7',
                    [UI.CaptionLabel]: 'text-sm font-medium',
                    [UI.PreviousMonthButton]: cn(
                      'absolute left-1 top-0 size-7 bg-transparent p-0 opacity-50 hover:opacity-100',
                    ),
                    [UI.NextMonthButton]: cn(
                      'absolute right-1 top-0 size-7 bg-transparent p-0 opacity-50 hover:opacity-100',
                    ),
                    [UI.MonthGrid]: 'w-full border-collapse space-y-1',
                    [UI.Weekdays]: 'flex',
                    [UI.Weekday]:
                      'text-muted-foreground rounded-md w-12 font-normal text-[0.8rem]',
                    [UI.Week]: 'flex w-full mt-2',
                    [DayFlag.outside]:
                      'day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30',
                    [DayFlag.disabled]: 'text-muted-foreground opacity-50',
                    [DayFlag.hidden]: 'invisible',
                  }}
                />
              </div>
            </div>

            {/* Right Side - Time Selection */}
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-stone-900">Select Time</h3>
                
                {/* Scheduling Options */}
                <div className="space-y-3">
                  {/* Queue Option */}
                  <div 
                    className={cn(
                      "p-4 rounded-xl border-2 cursor-pointer transition-all",
                      selectedOption === 'queue' 
                        ? "border-indigo-500 bg-indigo-50" 
                        : "border-gray-200 hover:border-gray-300"
                    )}
                    onClick={() => setSelectedOption('queue')}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        selectedOption === 'queue' ? "bg-indigo-100" : "bg-gray-100"
                      )}>
                        <Zap className="size-5 text-indigo-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-stone-900">Auto Queue</h4>
                        <p className="text-sm text-stone-600">
                          Automatically find the next available slot (10:00, 12:00, 2:00 PM)
                        </p>
                      </div>
                      {selectedOption === 'queue' && (
                        <Badge variant="default" className="bg-indigo-600">Recommended</Badge>
                      )}
                    </div>
                  </div>

                  {/* Custom Time Option */}
                  <div 
                    className={cn(
                      "p-4 rounded-xl border-2 cursor-pointer transition-all",
                      selectedOption === 'custom' 
                        ? "border-indigo-500 bg-indigo-50" 
                        : "border-gray-200 hover:border-gray-300"
                    )}
                    onClick={() => setSelectedOption('custom')}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        selectedOption === 'custom' ? "bg-indigo-100" : "bg-gray-100"
                      )}>
                        <Clock className="size-5 text-indigo-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-stone-900">Custom Time</h4>
                        <p className="text-sm text-stone-600">
                          Enter any specific time you want
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Manual Selection Option */}
                  <div 
                    className={cn(
                      "p-4 rounded-xl border-2 cursor-pointer transition-all",
                      selectedOption === 'manual' 
                        ? "border-indigo-500 bg-indigo-50" 
                        : "border-gray-200 hover:border-gray-300"
                    )}
                    onClick={() => setSelectedOption('manual')}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        selectedOption === 'manual' ? "bg-indigo-100" : "bg-gray-100"
                      )}>
                        <CalendarIcon className="size-5 text-indigo-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-stone-900">Quick Times</h4>
                        <p className="text-sm text-stone-600">
                          Choose from predefined 15-minute intervals
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Custom Time Input */}
                {selectedOption === 'custom' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-stone-500" />
                      <span className="text-sm font-medium text-stone-700">Enter Custom Time</span>
                    </div>
                    <DuolingoInput
                      type="time"
                      placeholder="HH:MM"
                      value={customTime}
                      onChange={(e) => handleCustomTimeChange(e.target.value)}
                      size="md"
                      icon={<Clock className="size-4" />}
                      helperText={customTime && !validateCustomTime(customTime) ? "Please enter a valid time (HH:MM)" : ""}
                      variant={customTime && !validateCustomTime(customTime) ? "error" : "default"}
                    />
                  </div>
                )}

                {/* Quick Time Slots */}
                {selectedOption === 'manual' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-stone-500" />
                      <span className="text-sm font-medium text-stone-700">Quick Times</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                      {timeSlots
                        .filter((time) => !isTimeSlotDisabled(time))
                        .map((time) => (
                          <Button
                            key={time}
                            variant={selectedTime === time && !useCustomTime ? 'default' : 'outline'}
                            onClick={() => handleTimeSlotClick(time)}
                            className="h-10 text-sm"
                          >
                            {time}
                          </Button>
                        ))}
                    </div>
                  </div>
                )}

                {/* Selected Date & Time Display */}
                {date && (
                  <div className="p-4 bg-stone-50 rounded-lg border">
                    <div className="text-sm text-stone-600">
                      {editMode ? 'Rescheduled for' : 'Scheduled for'}{' '}
                      <span className="font-medium text-stone-900">
                        {date?.toLocaleDateString('en-US', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                        })}
                      </span>
                      {selectedOption === 'queue' ? (
                        <span className="text-stone-600"> (auto-assigned time)</span>
                      ) : getCurrentTimeValue() ? (
                        <>
                          {' '}at <span className="font-medium text-stone-900">{getCurrentTimeValue()}</span>
                        </>
                      ) : (
                        <span className="text-stone-600"> (select time)</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t bg-stone-50">
          <DuolingoButton
            variant="secondary"
            onClick={onClose}
            size="md"
          >
            Cancel
          </DuolingoButton>

          <div className="flex gap-3">
            {selectedOption === 'queue' ? (
              <DuolingoButton
                loading={isQueueing}
                onClick={handleQueueClick}
                disabled={!date}
                size="md"
                className="min-w-[140px]"
              >
                <Zap className="size-4 mr-2" />
                <span className="whitespace-nowrap">Add to Queue</span>
              </DuolingoButton>
            ) : (
              <DuolingoButton
                loading={isPending}
                onClick={handleScheduleClick}
                disabled={!date || !getCurrentTimeValue()}
                size="md"
                className="min-w-[140px]"
              >
                <CalendarIcon className="size-4 mr-2" />
                <span className="whitespace-nowrap">
                  {editMode ? 'Reschedule' : 'Schedule'}
                </span>
              </DuolingoButton>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
} 