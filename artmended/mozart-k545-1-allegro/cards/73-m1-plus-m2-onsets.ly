\version "2.26.0"
#(set-global-staff-size 25)

\paper {
  indent = 0\mm
  top-margin = 4\mm
  bottom-margin = 4\mm
  left-margin = 4\mm
  right-margin = 4\mm
  paper-width = 150\mm
  paper-height = 75\mm
  print-page-number = ##f
  tagline = ##f
  page-breaking = #ly:one-page-breaking
}

upperCard = {
  \clef "treble"
  \key c \major
  \time 4/4
  \mark \markup { \box \bold "m. 1" }
  \clef treble \key c \major \time 4/4
c''2-1(\mp
e''4-3
g''4-5
  b'4.-1_>
  \bar "|."
}

lowerCard = {
  \clef "treble"
  \key c \major
  \time 4/4
  \clef treble \key c \major \time 4/4
c'8-5(\p
g'8-1
e'8-3
g'8
c'8
g'8
e'8
g'8)
  d'8-4 s1*1/4
  \bar "|."
}

\score {
  \new PianoStaff <<
    \set PianoStaff.connectArpeggios = ##t
    \new Staff = "upper" \upperCard
    \new Staff = "lower" \lowerCard
  >>
  \layout {
    ragged-right = ##f
    system-count = 1
  }
}
