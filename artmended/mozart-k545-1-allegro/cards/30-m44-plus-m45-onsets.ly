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
  \clef treble
  \key c \major
  \time 4/4
  \mark \markup { \box \bold "m. 44" }
  d'''2-3(_>
c'''4\<
f'''4\!
  c'''4-3_>
  \bar "|."
}

lowerCard = {
  \clef "treble"
  \key c \major
  \time 4/4
  f'8_\finger "(5)"
d''8-1
bes'8-2
d''8
f'8
c''8-1
a'8-3
c''8
  e'8-5 s1*1/8
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
